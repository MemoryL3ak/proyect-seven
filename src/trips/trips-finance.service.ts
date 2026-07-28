import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Panel financiero de Transporte.
 *
 * Modelo de negocio (core.provider_rates):
 *   client_price   → lo que se factura al cliente  → INGRESO
 *   provider_price → lo que se paga al proveedor   → COSTO
 *   diferencia                                     → MARGEN
 *
 * El ingreso de un viaje es `transport.trips.trip_cost` cuando está cargado
 * (valor pactado, manda sobre la tarifa); si viene vacío se cae a la tarifa
 * vigente del proveedor. El costo siempre sale de la tarifa, porque no existe
 * columna de costo por viaje.
 */

export type FinanceFilters = {
  eventId?: string;
  from?: string;
  to?: string;
  clientType?: string;
  fleet?: string;
  service?: string;
  providerId?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Estados que representan servicio efectivamente prestado (facturable). */
const DELIVERED = ['COMPLETED', 'DROPPED_OFF'];

@Injectable()
export class TripsFinanceService {
  private readonly logger = new Logger(TripsFinanceService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Vista financiera viaje a viaje. Es la base de todos los agregados: se
   * calcula una sola vez en SQL para que los totales, los desgloses y el
   * detalle no puedan contradecirse entre sí.
   *
   * Notas de resolución:
   * - Conductor: puede vivir en `transport.drivers` (flota propia) o en
   *   `core.provider_participants` (choferes de proveedor, que es donde está
   *   la operación real). Se consultan ambas.
   * - Flota: los viajes traen el tipo en formatos heterogéneos (`SEDAN`,
   *   `M3`, `Bus 31-40 asientos`, `Van Adaptada`), mientras que las tarifas
   *   usan un catálogo cerrado. `fleet_norm` traduce entre ambos.
   * - Tarifa: primero la del proveedor del conductor; si no hay, se usa la
   *   tarifa de mercado (promedio del catálogo) para no dejar el viaje sin
   *   valorizar, marcándolo como `REFERENCIA` para que el panel lo advierta.
   */
  private baseCte(): string {
    return `
      with filtrado as (
        select t.*
        from transport.trips t
        where ($1::uuid is null or t.event_id = $1)
          and ($2::date is null or coalesce(t.trip_date, (t.scheduled_at at time zone 'America/Santiago')::date) >= $2::date)
          and ($3::date is null or coalesce(t.trip_date, (t.scheduled_at at time zone 'America/Santiago')::date) <= $3::date)
      ),
      normalizado as (
        select
          f.*,
          coalesce(f.trip_date, (f.scheduled_at at time zone 'America/Santiago')::date) as dia,
          upper(coalesce(nullif(trim(f.requested_vehicle_type), ''), nullif(trim(f.fleet_acronym), ''), '')) as vt_raw,
          -- Mismo mapeo legacy que shared/client-types.ts: los datos antiguos
          -- traen ATHLETE/COACH/STAFF..., el vocabulario canónico es TA/TF/etc.
          case upper(coalesce(nullif(trim(f.client_type), ''), 'SIN TIPO'))
            when 'ATHLETE' then 'TA'
            when 'ATLETA' then 'TA'
            when 'DEPORTISTA' then 'TA'
            when 'COACH' then 'TF'
            when 'STAFF' then 'COMITE_ORGANIZADOR'
            when 'DELEGATION' then 'TF'
            when 'DELEGATION_LEAD' then 'TF'
            when 'OTHER' then 'VIP'
            when 'PROVIDER' then 'PROVEEDORES'
            else upper(coalesce(nullif(trim(f.client_type), ''), 'SIN TIPO'))
          end as client_type_norm
        from filtrado f
      ),
      con_flota as (
        select
          n.*,
          case
            -- MINIBUS antes que BUS: "MINIBUS" contiene "BUS".
            when n.vt_raw like '%MINI%' or n.vt_raw = 'M3' then 'MINIBUS'
            when n.vt_raw like '%BUS%'  or n.vt_raw = 'M4' then 'BUS'
            when n.vt_raw like '%ADAPT%' or n.vt_raw = 'M5' then 'VAN_10'
            when n.vt_raw like '%19%' then 'VAN_19'
            when n.vt_raw like '%15%' or n.vt_raw like '%17%' then 'VAN_15'
            when n.vt_raw like 'VAN%' or n.vt_raw = 'M2' then 'VAN_10'
            when n.vt_raw like '%SUV%' then 'SUV'
            when n.vt_raw like '%SEDAN%' or n.vt_raw like '%SEDÁN%'
              or n.vt_raw like '%AUTO%' or n.vt_raw = 'M1' then 'AUTO'
            else null
          end as fleet_norm,
          case
            when n.trip_type in ('VIAJE_IDA','VIAJE_REGRESO','VIAJE_IDA_REGRESO','TRANSFER_IN_OUT','DISPOSICION_12H')
              then n.trip_type
            when coalesce(n.is_round_trip, false) then 'VIAJE_IDA_REGRESO'
            when n.leg_type = 'RETURN' then 'VIAJE_REGRESO'
            else 'VIAJE_IDA'
          end as trip_type_norm
        from normalizado n
      ),
      con_conductor as (
        select
          c.*,
          coalesce(d.provider_id, pp.provider_id) as provider_id,
          coalesce(d.full_name, pp.full_name)     as driver_name
        from con_flota c
        left join transport.drivers d           on d.id  = c.driver_id
        left join core.provider_participants pp on pp.id = c.driver_id
        where ($4::text is null or c.client_type_norm = $4)
          and ($5::text is null or coalesce(c.fleet_norm, 'SIN CLASIFICAR') = $5)
          and ($6::text is null or c.trip_type_norm = $6)
          and ($7::uuid is null or coalesce(d.provider_id, pp.provider_id) = $7)
      ),
      -- Tarifa de referencia: promedio del catálogo por flota + tipo de
      -- servicio. Cubre viajes sin conductor o con proveedor sin tarifa.
      tarifa_mercado as (
        select fleet_type, trip_type,
               avg(client_price)::numeric   as client_price,
               avg(provider_price)::numeric as provider_price
        from core.provider_rates
        group by fleet_type, trip_type
      ),
      valorizado as (
        select
          c.*,
          pr.client_price   as rate_client,
          pr.provider_price as rate_provider,
          tm.client_price   as ref_client,
          tm.provider_price as ref_provider,
          p.name            as provider_name,
          -- Km por fila: largo de la ruta planificada (barato). El km GPS real
          -- se calcula aparte, una sola vez, en kmGpsTotals(): meterlo acá
          -- lo ejecutaba en las 9 consultas del resumen y saturaba el pool.
          coalesce(st_length(c.route_geometry::geography) / 1000.0, 0) as km_recorridos,
          -- INGRESO: valor pactado del viaje; si no hay, tarifa del proveedor;
          -- si tampoco, tarifa de referencia.
          coalesce(nullif(c.trip_cost, 0), pr.client_price, tm.client_price) as ingreso,
          coalesce(pr.provider_price, tm.provider_price)                     as costo,
          case
            when nullif(c.trip_cost, 0) is not null and pr.client_price is not null then 'PACTADO'
            when pr.client_price is not null then 'TARIFA'
            when nullif(c.trip_cost, 0) is not null then 'PACTADO_SIN_TARIFA'
            when tm.client_price is not null then 'REFERENCIA'
            else 'SIN_VALORIZAR'
          end as origen_valor
        from con_conductor c
        left join core.providers p on p.id = c.provider_id
        left join lateral (
          select r.client_price, r.provider_price
          from core.provider_rates r
          where r.provider_id = c.provider_id
            and r.fleet_type  = c.fleet_norm
            and r.trip_type   = c.trip_type_norm
          order by r.updated_at desc nulls last
          limit 1
        ) pr on true
        left join tarifa_mercado tm
          on tm.fleet_type = c.fleet_norm
         and tm.trip_type  = c.trip_type_norm
      )
    `;
  }

  private params(filters: FinanceFilters) {
    const safe = (d?: string) => (d && ISO_DATE.test(d) ? d : null);
    const text = (v?: string) => (v && v.trim() ? v.trim().toUpperCase() : null);
    const uuid = (v?: string) => (v && UUID.test(v) ? v : null);
    return [
      uuid(filters.eventId),
      safe(filters.from),
      safe(filters.to),
      text(filters.clientType),
      text(filters.fleet),
      text(filters.service),
      uuid(filters.providerId),
    ];
  }

  /**
   * Km recorridos del universo filtrado, viaje a viaje: la traza GPS real
   * (telemetry.vehicle_positions) cuando el viaje la tiene, y el largo de la
   * ruta planificada como respaldo. Sumar por viaje evita el problema de
   * mezclar fuentes con cobertura parcial (antes se tomaba el máximo entre
   * ambos totales, subestimando cuando unos viajes sólo tenían GPS y otros
   * sólo ruta). Es la consulta más pesada del panel, por eso:
   * - se ejecuta UNA sola vez por request (no dentro de cada agregado),
   * - corre con statement_timeout propio: si la telemetría es muy grande,
   *   el panel carga igual y los totales caen al largo de ruta planificada.
   */
  private async kmGpsTotals(
    params: unknown[],
    delivered: string,
  ): Promise<{ km: number; kmPrestados: number } | null> {
    try {
      const rows = await this.dataSource.transaction(async (em) => {
        await em.query(`set local statement_timeout = '2500ms'`);
        return em.query(
          `${this.baseCte()}
           select
             coalesce(sum(t.km), 0)::numeric                                          as km,
             coalesce(sum(t.km) filter (where t.status in ${delivered}), 0)::numeric  as km_prestados
           from (
             select c.id, c.status,
                    coalesce(
                      nullif(g.km_gps, 0),
                      st_length(c.route_geometry::geography) / 1000.0,
                      0
                    ) as km
             from con_conductor c
             left join lateral (
               select st_length(st_makeline(vp.location order by vp."timestamp")::geography) / 1000.0 as km_gps
               from telemetry.vehicle_positions vp
               where vp.trip_id = c.id
             ) g on true
             where c.status <> 'CANCELLED'
           ) t`,
          params,
        );
      });
      const r = rows?.[0];
      if (!r) return null;
      return { km: Number(r.km ?? 0), kmPrestados: Number(r.km_prestados ?? 0) };
    } catch (error) {
      this.logger.warn(
        `Km GPS no disponibles (se usa el largo de ruta): ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  async summary(filters: FinanceFilters = {}) {
    const params = this.params(filters);
    const delivered = `('${DELIVERED.join("','")}')`;

    const [totals, byProvider, byFleet, byTripType, byClientType, daily, topDrivers, unvalued, budget, kmGps] =
      await Promise.all([
        this.dataSource.query(
          `${this.baseCte()}
           select
             count(*)::int                                                    as viajes,
             count(*) filter (where status = 'CANCELLED')::int                as cancelados,
             count(*) filter (where status in ${delivered})::int              as prestados,
             count(*) filter (where origen_valor = 'SIN_VALORIZAR')::int      as sin_valorizar,
             count(*) filter (where origen_valor = 'REFERENCIA')::int         as por_referencia,
             coalesce(sum(passenger_count), 0)::int                           as pasajeros,
             coalesce(sum(km_recorridos) filter (where status <> 'CANCELLED'), 0)::numeric as km_recorridos,
             coalesce(sum(km_recorridos) filter (where status in ${delivered}), 0)::numeric as km_prestados,
             coalesce(sum(ingreso) filter (where status <> 'CANCELLED'), 0)::numeric as ingreso_total,
             coalesce(sum(costo)   filter (where status <> 'CANCELLED'), 0)::numeric as costo_total,
             coalesce(sum(ingreso) filter (where status in ${delivered}), 0)::numeric as ingreso_prestado,
             coalesce(sum(costo)   filter (where status in ${delivered}), 0)::numeric as costo_prestado,
             coalesce(sum(ingreso) filter (where status not in ${delivered} and status <> 'CANCELLED'), 0)::numeric as ingreso_comprometido,
             coalesce(sum(ingreso) filter (where status = 'CANCELLED'), 0)::numeric   as ingreso_anulado
           from valorizado`,
          params,
        ),
        this.dataSource.query(
          `${this.baseCte()}
           select
             v.provider_id                                        as provider_id,
             coalesce(v.provider_name, 'Sin proveedor asignado')   as nombre,
             count(*)::int                                         as viajes,
             coalesce(sum(v.ingreso) filter (where v.status <> 'CANCELLED'), 0)::numeric as ingreso,
             coalesce(sum(v.costo)   filter (where v.status <> 'CANCELLED'), 0)::numeric as costo,
             max(p.bid_amount)::numeric                            as adjudicado,
             max(p.bid_trip_count)::int                            as viajes_licitados
           from valorizado v
           left join core.providers p on p.id = v.provider_id
           group by v.provider_id, v.provider_name
           order by ingreso desc nulls last`,
          params,
        ),
        this.dataSource.query(
          `${this.baseCte()}
           select
             coalesce(fleet_norm, 'SIN CLASIFICAR') as clave,
             count(*)::int                          as viajes,
             coalesce(sum(ingreso) filter (where status <> 'CANCELLED'), 0)::numeric as ingreso,
             coalesce(sum(costo)   filter (where status <> 'CANCELLED'), 0)::numeric as costo,
             coalesce(sum(km_recorridos) filter (where status <> 'CANCELLED'), 0)::numeric as km
           from valorizado group by 1 order by ingreso desc nulls last`,
          params,
        ),
        this.dataSource.query(
          `${this.baseCte()}
           select
             trip_type_norm as clave,
             count(*)::int  as viajes,
             coalesce(sum(ingreso) filter (where status <> 'CANCELLED'), 0)::numeric as ingreso,
             coalesce(sum(costo)   filter (where status <> 'CANCELLED'), 0)::numeric as costo,
             coalesce(sum(km_recorridos) filter (where status <> 'CANCELLED'), 0)::numeric as km
           from valorizado group by 1 order by ingreso desc nulls last`,
          params,
        ),
        this.dataSource.query(
          `${this.baseCte()}
           select
             client_type_norm as clave,
             count(*)::int                                 as viajes,
             coalesce(sum(ingreso) filter (where status <> 'CANCELLED'), 0)::numeric as ingreso,
             coalesce(sum(costo)   filter (where status <> 'CANCELLED'), 0)::numeric as costo,
             coalesce(sum(km_recorridos) filter (where status <> 'CANCELLED'), 0)::numeric as km
           from valorizado group by 1 order by ingreso desc nulls last`,
          params,
        ),
        this.dataSource.query(
          `${this.baseCte()}
           select
             dia::text     as fecha,
             count(*)::int as viajes,
             coalesce(sum(ingreso) filter (where status <> 'CANCELLED'), 0)::numeric as ingreso,
             coalesce(sum(costo)   filter (where status <> 'CANCELLED'), 0)::numeric as costo,
             coalesce(sum(km_recorridos) filter (where status <> 'CANCELLED'), 0)::numeric as km
           from valorizado where dia is not null group by 1 order by 1 asc`,
          params,
        ),
        this.dataSource.query(
          `${this.baseCte()}
           select
             driver_id                                     as driver_id,
             coalesce(driver_name, 'Sin conductor')         as nombre,
             coalesce(provider_name, '—')                   as proveedor,
             count(*)::int                                  as viajes,
             coalesce(sum(ingreso) filter (where status <> 'CANCELLED'), 0)::numeric as ingreso,
             coalesce(sum(costo)   filter (where status <> 'CANCELLED'), 0)::numeric as costo,
             coalesce(sum(km_recorridos) filter (where status <> 'CANCELLED'), 0)::numeric as km
           from valorizado
           where driver_id is not null
           group by driver_id, driver_name, provider_name
           order by ingreso desc nulls last
           limit 12`,
          params,
        ),
        this.dataSource.query(
          `${this.baseCte()}
           select
             id, dia::text as fecha, status,
             coalesce(nullif(client_type,''), '—') as client_type,
             coalesce(nullif(vt_raw,''), '—')      as vehiculo,
             trip_type_norm                        as servicio,
             fleet_norm                            as flota_normalizada,
             origen_valor                          as origen,
             coalesce(origin,'—')                  as origen_texto,
             coalesce(destination,'—')             as destino
           from valorizado
           where origen_valor in ('SIN_VALORIZAR','REFERENCIA','PACTADO_SIN_TARIFA')
             and status <> 'CANCELLED'
           order by dia desc nulls last
           limit 100`,
          params,
        ),
        this.dataSource.query(
          `select
             coalesce(sum(bid_amount), 0)::numeric   as adjudicado,
             coalesce(sum(bid_trip_count), 0)::int   as viajes_licitados,
             count(*)::int                           as proveedores
           from core.providers
           where bid_amount is not null`,
          [],
        ),
        this.kmGpsTotals(params, delivered),
      ]);

    const t = totals[0] || {};
    const num = (v: unknown) => Number(v ?? 0);

    const ingresoTotal = num(t.ingreso_total);
    const costoTotal = num(t.costo_total);
    const ingresoPrestado = num(t.ingreso_prestado);
    const costoPrestado = num(t.costo_prestado);
    const viajesActivos = num(t.viajes) - num(t.cancelados);

    const b = budget[0] || {};
    const adjudicado = num(b.adjudicado);
    const viajesLicitados = num(b.viajes_licitados);

    const mapGrupo = (rows: any[]) =>
      rows.map((r) => {
        const ingreso = num(r.ingreso);
        const costo = num(r.costo);
        return {
          clave: r.clave,
          viajes: num(r.viajes),
          ingreso,
          costo,
          margen: ingreso - costo,
          margenPct: ingreso > 0 ? ((ingreso - costo) / ingreso) * 100 : 0,
          ticketPromedio: r.viajes ? ingreso / num(r.viajes) : 0,
          km: num(r.km),
        };
      });

    return {
      generadoEn: new Date().toISOString(),
      moneda: 'CLP',
      filtros: {
        eventId: filters.eventId ?? null,
        desde: filters.from ?? null,
        hasta: filters.to ?? null,
        clientType: filters.clientType ?? null,
        fleet: filters.fleet ?? null,
        service: filters.service ?? null,
        providerId: filters.providerId ?? null,
      },
      totales: {
        viajes: num(t.viajes),
        viajesActivos,
        viajesPrestados: num(t.prestados),
        viajesCancelados: num(t.cancelados),
        pasajeros: num(t.pasajeros),
        // Suma por viaje de GPS real con respaldo de ruta planificada; si la
        // consulta de telemetría falló o dio timeout, el largo de las rutas.
        kmRecorridos: kmGps ? kmGps.km : num(t.km_recorridos),
        kmPrestados: kmGps ? kmGps.kmPrestados : num(t.km_prestados),
        ingresoTotal,
        costoTotal,
        margenTotal: ingresoTotal - costoTotal,
        margenPct: ingresoTotal > 0 ? ((ingresoTotal - costoTotal) / ingresoTotal) * 100 : 0,
        ingresoPrestado,
        costoPrestado,
        margenPrestado: ingresoPrestado - costoPrestado,
        ingresoComprometido: num(t.ingreso_comprometido),
        ingresoAnulado: num(t.ingreso_anulado),
        ticketPromedio: viajesActivos > 0 ? ingresoTotal / viajesActivos : 0,
        costoPorPasajero: num(t.pasajeros) > 0 ? costoTotal / num(t.pasajeros) : 0,
      },
      calidadDatos: {
        sinValorizar: num(t.sin_valorizar),
        porReferencia: num(t.por_referencia),
        cobertura:
          num(t.viajes) > 0
            ? ((num(t.viajes) - num(t.sin_valorizar)) / num(t.viajes)) * 100
            : 100,
      },
      presupuesto: {
        adjudicado,
        viajesLicitados,
        proveedoresConLicitacion: num(b.proveedores),
        consumido: ingresoTotal,
        disponible: adjudicado - ingresoTotal,
        pctConsumido: adjudicado > 0 ? (ingresoTotal / adjudicado) * 100 : 0,
        pctViajes: viajesLicitados > 0 ? (viajesActivos / viajesLicitados) * 100 : 0,
      },
      porProveedor: byProvider.map((r: any) => {
        const ingreso = num(r.ingreso);
        const costo = num(r.costo);
        const adj = num(r.adjudicado);
        return {
          providerId: r.provider_id,
          nombre: r.nombre,
          viajes: num(r.viajes),
          ingreso,
          costo,
          margen: ingreso - costo,
          margenPct: ingreso > 0 ? ((ingreso - costo) / ingreso) * 100 : 0,
          adjudicado: adj,
          viajesLicitados: num(r.viajes_licitados),
          pctConsumido: adj > 0 ? (ingreso / adj) * 100 : null,
        };
      }),
      porFlota: mapGrupo(byFleet),
      porServicio: mapGrupo(byTripType),
      porTipoCliente: mapGrupo(byClientType),
      serieDiaria: daily.map((r: any) => {
        const ingreso = num(r.ingreso);
        const costo = num(r.costo);
        return {
          fecha: r.fecha,
          viajes: num(r.viajes),
          ingreso,
          costo,
          margen: ingreso - costo,
          km: num(r.km),
        };
      }),
      topConductores: topDrivers.map((r: any) => {
        const ingreso = num(r.ingreso);
        const costo = num(r.costo);
        return {
          driverId: r.driver_id,
          nombre: r.nombre,
          proveedor: r.proveedor,
          viajes: num(r.viajes),
          ingreso,
          costo,
          margen: ingreso - costo,
          ticketPromedio: num(r.viajes) > 0 ? ingreso / num(r.viajes) : 0,
          km: num(r.km),
        };
      }),
      viajesSinTarifa: unvalued.map((r: any) => ({
        id: r.id,
        fecha: r.fecha,
        status: r.status,
        clientType: r.client_type,
        vehiculo: r.vehiculo,
        servicio: r.servicio,
        flotaNormalizada: r.flota_normalizada,
        origen: r.origen,
        ruta: `${r.origen_texto} → ${r.destino}`,
      })),
    };
  }

  /** Detalle viaje a viaje valorizado, para la tabla y la exportación. */
  async detail(filters: FinanceFilters = {}) {
    const rows = await this.dataSource.query(
      `${this.baseCte()}
       select
         v.id,
         v.dia::text                              as fecha,
         v.scheduled_at                           as programado,
         v.status,
         coalesce(nullif(v.client_type,''),'—')   as client_type,
         v.trip_type_norm                         as servicio,
         coalesce(v.fleet_norm,'—')               as flota,
         coalesce(nullif(v.vt_raw,''),'—')        as vehiculo_solicitado,
         coalesce(v.driver_name,'Sin asignar')    as conductor,
         coalesce(v.provider_name,'—')            as proveedor,
         coalesce(v.origin,'—')                   as origen,
         coalesce(v.destination,'—')              as destino,
         coalesce(v.passenger_count,0)::int       as pasajeros,
         coalesce(v.km_recorridos,0)::numeric     as km,
         coalesce(v.ingreso,0)::numeric           as ingreso,
         coalesce(v.costo,0)::numeric             as costo,
         (coalesce(v.ingreso,0) - coalesce(v.costo,0))::numeric as margen,
         v.origen_valor                           as origen_valor
       from valorizado v
       order by v.dia desc nulls last, v.scheduled_at desc nulls last
       limit 1000`,
      this.params(filters),
    );

    return rows.map((r: any) => ({
      id: r.id,
      fecha: r.fecha,
      programado: r.programado,
      status: r.status,
      clientType: r.client_type,
      servicio: r.servicio,
      flota: r.flota,
      vehiculoSolicitado: r.vehiculo_solicitado,
      conductor: r.conductor,
      proveedor: r.proveedor,
      origen: r.origen,
      destino: r.destino,
      pasajeros: Number(r.pasajeros ?? 0),
      km: Number(r.km ?? 0),
      ingreso: Number(r.ingreso ?? 0),
      costo: Number(r.costo ?? 0),
      margen: Number(r.margen ?? 0),
      origenValor: r.origen_valor,
    }));
  }
}
