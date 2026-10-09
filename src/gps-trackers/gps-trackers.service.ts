import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import * as net from 'net';
import { DataSource } from 'typeorm';
import { interpretar, MensajeGt06, PosicionGt06, respuestaPara, separarTramas, TramaGt06 } from './gt06';

/**
 * Receptor de rastreadores GPS de vehículo (OBD, protocolo GT06) por TCP.
 *
 * 09-10-2026: la posición del bus deja de depender del teléfono del
 * conductor. El equipo se apunta a este servidor por SMS
 * (SERVER,1,<host>,<puerto>,0#) y cada posición entra a
 * telemetry.vehicle_positions como las de la app, con el vehículo al que
 * está asignado el IMEI (telemetry.gps_devices) y el conductor que tiene el
 * viaje con ese vehículo.
 *
 * Railway: la app escucha en GPS_TCP_PORT (7018) y el "TCP Proxy" del
 * servicio lo publica en <algo>.proxy.rlwy.net:<puerto público>.
 */

export type EstadoEquipo = {
  imei: string;
  conectado: boolean;
  conectadoDesde: string | null;
  ultimoPaquete: string | null;
  ultimaPosicion: (PosicionGt06 & { recibida: string }) | null;
  paquetes: number;
  posicionesGuardadas: number;
  vehicleId: string | null;
  vehiclePlate: string | null;
  eventId: string | null;
  ultimoError: string | null;
};

export type PaqueteRegistrado = {
  en: string;
  imei: string | null;
  origen: string;
  protocolo: number | null;
  tipo: string;
  serie: number | null;
  crcOk: boolean | null;
  hex: string;
  respuesta: string | null;
  posicion: PosicionGt06 | null;
};

type Conexion = { buffer: Buffer; imei: string | null; desde: Date; origen: string };
type Asignacion = { vehicleId: string | null; eventId: string | null; plate: string | null; leidaEn: number };

const MAX_PAQUETES = 300;
const MAX_BUFFER = 4096;
const CACHE_ASIGNACION_MS = 5 * 60 * 1000;
const INACTIVIDAD_MS = 15 * 60 * 1000;

@Injectable()
export class GpsTrackersService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('GpsTrackers');
  private servidor: net.Server | null = null;
  private readonly conexiones = new Map<net.Socket, Conexion>();
  private readonly equipos = new Map<string, EstadoEquipo>();
  private readonly asignaciones = new Map<string, Asignacion>();
  private readonly paquetes: PaqueteRegistrado[] = [];
  /** null = todavía no se intentó leer telemetry.gps_devices. */
  private tablaDisponible: boolean | null = null;

  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly dataSource: DataSource,
  ) {}

  get puerto(): number {
    return Number(process.env.GPS_TCP_PORT ?? 7018) || 0;
  }

  onApplicationBootstrap() {
    const puerto = this.puerto;
    if (!puerto) {
      this.logger.log('Receptor GPS apagado (GPS_TCP_PORT=0).');
      return;
    }
    this.servidor = net.createServer((socket) => this.atender(socket));
    this.servidor.on('error', (err) => this.logger.error(`Receptor GPS: ${err.message}`));
    this.servidor.listen(puerto, '0.0.0.0', () => this.logger.log(`Receptor GPS (GT06) escuchando en TCP ${puerto}`));
  }

  onApplicationShutdown() {
    for (const socket of this.conexiones.keys()) socket.destroy();
    this.servidor?.close();
  }

  // ── Conexiones ──────────────────────────────────────────────────────────

  private atender(socket: net.Socket) {
    const origen = `${socket.remoteAddress ?? '?'}:${socket.remotePort ?? '?'}`;
    this.conexiones.set(socket, { buffer: Buffer.alloc(0), imei: null, desde: new Date(), origen });
    socket.setTimeout(INACTIVIDAD_MS, () => socket.destroy());
    socket.on('data', (datos) => {
      this.recibir(socket, datos).catch((err) => this.logger.warn(`Receptor GPS ${origen}: ${err instanceof Error ? err.message : err}`));
    });
    socket.on('error', (err) => this.logger.warn(`Receptor GPS ${origen}: ${err.message}`));
    socket.on('close', () => {
      const c = this.conexiones.get(socket);
      if (c?.imei) {
        const e = this.equipos.get(c.imei);
        if (e) e.conectado = false;
      }
      this.conexiones.delete(socket);
    });
  }

  private async recibir(socket: net.Socket, datos: Buffer) {
    const c = this.conexiones.get(socket);
    if (!c) return;
    const { tramas, resto, basura } = separarTramas(Buffer.concat([c.buffer, datos]));
    c.buffer = resto.length > MAX_BUFFER ? Buffer.alloc(0) : resto;
    for (const b of basura) {
      // Bytes que no son GT06: se registran para reconocer un equipo que
      // hable otro protocolo (texto, por ejemplo) sin perder la evidencia.
      this.registrar({ en: new Date().toISOString(), imei: c.imei, origen: c.origen, protocolo: null, tipo: 'desconocido', serie: null, crcOk: null, hex: b.subarray(0, 96).toString('hex'), respuesta: null, posicion: null });
    }
    for (const trama of tramas) await this.procesar(socket, c, trama);
  }

  private async procesar(socket: net.Socket, c: Conexion, trama: TramaGt06) {
    const mensaje = interpretar(trama);
    const respuesta = respuestaPara(mensaje);
    if (respuesta) socket.write(respuesta);
    if (mensaje.tipo === 'login') c.imei = mensaje.imei;
    const equipo = c.imei ? this.equipo(c.imei) : null;
    if (equipo) {
      equipo.conectado = true;
      equipo.conectadoDesde = equipo.conectadoDesde ?? c.desde.toISOString();
      equipo.ultimoPaquete = new Date().toISOString();
      equipo.paquetes += 1;
    }
    this.registrar({
      en: new Date().toISOString(),
      imei: c.imei,
      origen: c.origen,
      protocolo: trama.protocolo,
      tipo: mensaje.tipo,
      serie: trama.serie,
      crcOk: trama.crcOk,
      hex: trama.cruda.subarray(0, 96).toString('hex'),
      respuesta: respuesta ? respuesta.toString('hex') : null,
      posicion: mensaje.tipo === 'posicion' ? mensaje.posicion : null,
    });
    if (mensaje.tipo === 'login') await this.registrarEquipo(mensaje.imei);
    if (mensaje.tipo === 'posicion' && c.imei) await this.guardarPosicion(c.imei, mensaje);
  }

  private registrar(p: PaqueteRegistrado) {
    this.paquetes.push(p);
    if (this.paquetes.length > MAX_PAQUETES) this.paquetes.splice(0, this.paquetes.length - MAX_PAQUETES);
  }

  private equipo(imei: string): EstadoEquipo {
    let e = this.equipos.get(imei);
    if (!e) {
      e = { imei, conectado: false, conectadoDesde: null, ultimoPaquete: null, ultimaPosicion: null, paquetes: 0, posicionesGuardadas: 0, vehicleId: null, vehiclePlate: null, eventId: null, ultimoError: null };
      this.equipos.set(imei, e);
    }
    return e;
  }

  // ── Equipos y vehículos (telemetry.gps_devices) ─────────────────────────

  private esTablaAusente(error: { code?: string; message?: string } | null): boolean {
    return Boolean(error && (error.code === '42P01' || /gps_devices/.test(error.message ?? '') && /not find|does not exist|schema cache/i.test(error.message ?? '')));
  }

  private async registrarEquipo(imei: string) {
    if (this.tablaDisponible === false) return;
    const { error } = await this.supabase
      .schema('telemetry')
      .from('gps_devices')
      .upsert({ imei, last_seen_at: new Date().toISOString() }, { onConflict: 'imei' });
    if (error) {
      if (this.esTablaAusente(error)) {
        this.tablaDisponible = false;
        this.logger.warn('telemetry.gps_devices no existe todavía: los equipos se ven en memoria, sin vehículo asignado (scripts/gps-trackers/gps_devices.sql).');
      } else {
        this.logger.warn(`gps_devices ${imei}: ${error.message}`);
      }
      return;
    }
    this.tablaDisponible = true;
  }

  private async asignacionDe(imei: string): Promise<Asignacion> {
    const cache = this.asignaciones.get(imei);
    if (cache && Date.now() - cache.leidaEn < CACHE_ASIGNACION_MS) return cache;
    const vacia: Asignacion = { vehicleId: null, eventId: null, plate: null, leidaEn: Date.now() };
    if (this.tablaDisponible === false) return vacia;
    const { data, error } = await this.supabase
      .schema('telemetry')
      .from('gps_devices')
      .select('vehicle_id')
      .eq('imei', imei)
      .maybeSingle();
    if (error) {
      if (this.esTablaAusente(error)) this.tablaDisponible = false;
      return vacia;
    }
    this.tablaDisponible = true;
    const vehicleId = (data?.vehicle_id as string | null) ?? null;
    if (!vehicleId) {
      this.asignaciones.set(imei, vacia);
      return vacia;
    }
    const filas = (await this.dataSource.query(`select plate, event_id from transport.vehicles where id = $1`, [vehicleId])) as Array<{ plate: string | null; event_id: string | null }>;
    const a: Asignacion = { vehicleId, eventId: filas[0]?.event_id ?? null, plate: filas[0]?.plate ?? null, leidaEn: Date.now() };
    this.asignaciones.set(imei, a);
    return a;
  }

  /**
   * A quién se le atribuye la posición del vehículo: al conductor del viaje
   * en curso con ese vehículo; si no hay, al del viaje de hoy más cercano
   * en hora (el bus en el patio sigue siendo "su" bus en el monitoreo).
   */
  private async conductorDelVehiculo(vehicleId: string): Promise<{ driverId: string | null; tripId: string | null; eventId: string | null }> {
    const filas = (await this.dataSource.query(
      `select id, driver_id, event_id, status
         from transport.trips
        where vehicle_id = $1
          and status not in ('CANCELLED')
          and (status in ('EN_ROUTE','PICKED_UP')
               or (scheduled_at at time zone 'America/Santiago')::date = (now() at time zone 'America/Santiago')::date)
        order by (status in ('EN_ROUTE','PICKED_UP')) desc, abs(extract(epoch from (scheduled_at - now()))) asc
        limit 1`,
      [vehicleId],
    )) as Array<{ id: string; driver_id: string | null; event_id: string | null; status: string }>;
    const t = filas[0];
    if (!t) return { driverId: null, tripId: null, eventId: null };
    const enCurso = t.status === 'EN_ROUTE' || t.status === 'PICKED_UP';
    return { driverId: t.driver_id, tripId: enCurso ? t.id : null, eventId: t.event_id };
  }

  private async guardarPosicion(imei: string, m: Extract<MensajeGt06, { tipo: 'posicion' }>) {
    const equipo = this.equipo(imei);
    const p = m.posicion;
    if (!p || !p.valido) return; // sin fijo satelital: la lat/lng es la última conocida
    equipo.ultimaPosicion = { ...p, recibida: new Date().toISOString() };
    const a = await this.asignacionDe(imei);
    equipo.vehicleId = a.vehicleId;
    equipo.vehiclePlate = a.plate;
    equipo.eventId = a.eventId;
    if (!a.vehicleId) return; // equipo sin vehículo: queda a la vista en el panel para asignarlo
    const c = await this.conductorDelVehiculo(a.vehicleId);
    const fila = {
      event_id: c.eventId ?? a.eventId,
      vehicle_id: a.vehicleId,
      driver_id: c.driverId,
      trip_id: c.tripId,
      timestamp: p.fecha.toISOString(),
      location: { type: 'Point', coordinates: [p.lng, p.lat] },
      // La app guarda m/s (Geolocation); el equipo informa km/h.
      speed: p.velocidad / 3.6,
      heading: p.rumbo,
    };
    const { error } = await this.supabase.schema('telemetry').from('vehicle_positions').insert(fila);
    if (error) {
      equipo.ultimoError = error.message;
      this.logger.warn(`posición de ${imei} (${a.plate ?? a.vehicleId}): ${error.message}`);
      return;
    }
    equipo.ultimoError = null;
    equipo.posicionesGuardadas += 1;
  }

  // ── Panel ───────────────────────────────────────────────────────────────

  async listar(): Promise<{ puerto: number; tabla: boolean | null; equipos: EstadoEquipo[] }> {
    const equipos = Array.from(this.equipos.values());
    if (this.tablaDisponible !== false) {
      const { data, error } = await this.supabase
        .schema('telemetry')
        .from('gps_devices')
        .select('imei, vehicle_id, label, last_seen_at')
        .order('last_seen_at', { ascending: false, nullsFirst: false });
      if (!error && data) {
        this.tablaDisponible = true;
        for (const fila of data as Array<{ imei: string; vehicle_id: string | null; label: string | null; last_seen_at: string | null }>) {
          const e = this.equipo(fila.imei);
          e.vehicleId = fila.vehicle_id;
          if (!e.ultimoPaquete && fila.last_seen_at) e.ultimoPaquete = fila.last_seen_at;
        }
      } else if (this.esTablaAusente(error)) {
        this.tablaDisponible = false;
      }
    }
    const ids = Array.from(new Set(Array.from(this.equipos.values()).map((e) => e.vehicleId).filter((v): v is string => Boolean(v))));
    if (ids.length > 0) {
      const filas = (await this.dataSource.query(`select id, plate, event_id from transport.vehicles where id = any($1)`, [ids])) as Array<{ id: string; plate: string | null; event_id: string | null }>;
      const porId = new Map(filas.map((f) => [f.id, f]));
      for (const e of this.equipos.values()) {
        const v = e.vehicleId ? porId.get(e.vehicleId) : undefined;
        e.vehiclePlate = v?.plate ?? null;
        e.eventId = v?.event_id ?? null;
      }
    }
    return { puerto: this.puerto, tabla: this.tablaDisponible, equipos: Array.from(this.equipos.values()).sort((x, y) => (y.ultimoPaquete ?? '').localeCompare(x.ultimoPaquete ?? '')) };
  }

  ultimosPaquetes(imei?: string, limite = 100): PaqueteRegistrado[] {
    const lista = imei ? this.paquetes.filter((p) => p.imei === imei) : this.paquetes;
    return lista.slice(-limite).reverse();
  }

  async asignar(imei: string, vehicleId: string | null, label?: string | null): Promise<EstadoEquipo> {
    const { error } = await this.supabase
      .schema('telemetry')
      .from('gps_devices')
      .upsert({ imei, vehicle_id: vehicleId, ...(label !== undefined ? { label } : {}) }, { onConflict: 'imei' });
    if (error) throw new Error(this.esTablaAusente(error) ? 'Falta crear telemetry.gps_devices (scripts/gps-trackers/gps_devices.sql)' : error.message);
    this.tablaDisponible = true;
    this.asignaciones.delete(imei);
    const e = this.equipo(imei);
    e.vehicleId = vehicleId;
    return e;
  }
}
