import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import * as net from 'net';
import { DataSource } from 'typeorm';
import { comandoEnLinea, interpretar, MensajeGt06, PosicionGt06, PuntoGuardado, respuestaPara, separarTramas, TramaGt06, valeGuardar } from './gt06';

/**
 * Receptor de rastreadores GPS de vehículo (OBD, protocolo GT06) por TCP.
 *
 * 09-10-2026: la posición del bus deja de depender del teléfono del
 * conductor. El equipo se apunta a este servidor por SMS
 * (SERVER,1,<host>,<puerto>,0#). Cada equipo (IMEI) se asigna a una
 * PATENTE —los viajes y las fichas de los conductores identifican al
 * vehículo por patente; transport.vehicles no se usa— y cada posición se
 * atribuye al conductor del viaje con esa patente (en curso, o el de hoy
 * más cercano) o, si no hay viaje, al conductor cuya ficha lleva esa
 * patente. Con conductor, la posición entra a telemetry.vehicle_positions
 * como las de la app; siempre queda la última en telemetry.gps_devices.
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
  /** Patente asignada al equipo (normalizada: mayúsculas, sin espacios ni guiones). */
  vehiclePlate: string | null;
  eventId: string | null;
  label: string | null;
  /** Conductor al que se atribuye la posición. */
  conductorId: string | null;
  conductorNombre: string | null;
  tripId: string | null;
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
  /** Para los eventos de conexión: quién cerró y por qué. */
  nota?: string;
};

type Conexion = { buffer: Buffer; imei: string | null; desde: Date; origen: string };
type Atribucion = { driverId: string | null; tripId: string | null; eventId: string | null; leidaEn: number };
type FilaEquipo = {
  imei: string;
  plate: string | null;
  label: string | null;
  last_seen_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_fix_at: string | null;
  last_speed: number | null;
  last_heading: number | null;
};

const MAX_PAQUETES = 300;
const MAX_BUFFER = 4096;
const CACHE_PLACA_MS = 5 * 60 * 1000;
const CACHE_ATRIBUCION_MS = 60 * 1000;
const INACTIVIDAD_MS = 15 * 60 * 1000;
/** Cada cuánto se refresca last_seen_at en la base por equipo (sobrevive a reinicios). */
const REGISTRO_MS = 60 * 1000;
/** Un comando en cola sale este tiempo después del login, cuando el equipo ya mandó su latido. */
const ESPERA_COMANDO_MS = 6_000;

/** "JJ JC 74", "jjjc-74" y "JJJC74" son la misma patente. */
export const normalizarPatente = (valor: string | null | undefined): string | null => {
  const p = String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return p || null;
};

@Injectable()
export class GpsTrackersService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('GpsTrackers');
  private servidor: net.Server | null = null;
  private readonly conexiones = new Map<net.Socket, Conexion>();
  private readonly equipos = new Map<string, EstadoEquipo>();
  /** Patente asignada por IMEI, leída de la tabla (con vencimiento). */
  private readonly placas = new Map<string, { plate: string | null; leidaEn: number }>();
  /** Conductor por patente (con vencimiento: el viaje en curso cambia durante el día). */
  private readonly atribuciones = new Map<string, Atribucion>();
  private readonly paquetes: PaqueteRegistrado[] = [];
  private readonly ultimoRegistro = new Map<string, number>();
  /** Última posición guardada por IMEI (para no guardar una cada 2 s detenido). */
  private readonly ultimaGuardada = new Map<string, PuntoGuardado>();
  /** Comandos en línea esperando a que el equipo se conecte (se mandan tras el login). */
  private readonly comandosPendientes = new Map<string, string[]>();
  private serieComando = 1;
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

  private evento(socket: net.Socket, origen: string, nota: string) {
    this.registrar({ en: new Date().toISOString(), imei: this.conexiones.get(socket)?.imei ?? null, origen, protocolo: null, tipo: 'conexion', serie: null, crcOk: null, hex: '', respuesta: null, posicion: null, nota });
  }

  private atender(socket: net.Socket) {
    const origen = `${socket.remoteAddress ?? '?'}:${socket.remotePort ?? '?'}`;
    // Las respuestas son de 10 bytes y el equipo las espera: sin Nagle salen
    // en el acto, no cuando el sistema junte más datos.
    socket.setNoDelay(true);
    this.conexiones.set(socket, { buffer: Buffer.alloc(0), imei: null, desde: new Date(), origen });
    // El ciclo de la conexión también queda en el registro: un equipo que
    // conecta, hace login y corta se diagnostica por acá (09-10-2026: el
    // G500LS con el motor apagado conecta, late y cierra cada ~45 s).
    this.evento(socket, origen, 'abierta');
    socket.setTimeout(INACTIVIDAD_MS, () => {
      this.evento(socket, origen, `cerrada por inactividad (${INACTIVIDAD_MS / 60000} min)`);
      socket.destroy();
    });
    socket.on('end', () => this.evento(socket, origen, 'el equipo cerró (FIN)'));
    socket.on('data', (datos) => {
      this.recibir(socket, datos).catch((err) => this.logger.warn(`Receptor GPS ${origen}: ${err instanceof Error ? err.message : err}`));
    });
    socket.on('error', (err) => {
      this.logger.warn(`Receptor GPS ${origen}: ${err.message}`);
      this.evento(socket, origen, `error: ${err.message}`);
    });
    socket.on('close', (conError) => {
      const c = this.conexiones.get(socket);
      // Lo que quedó sin tramar al cerrar: una trama a medias o un formato
      // que el separador no reconoce.
      if (c && c.buffer.length > 0) {
        this.registrar({ en: new Date().toISOString(), imei: c.imei, origen, protocolo: null, tipo: 'resto', serie: null, crcOk: null, hex: c.buffer.subarray(0, 160).toString('hex'), respuesta: null, posicion: null, nota: `${c.buffer.length} bytes sin tramar al cerrar` });
      }
      this.evento(socket, origen, conError ? 'cerrada con error' : 'cerrada');
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
    // Cada trozo TCP tal cual llega, antes de interpretarlo. 09-10-2026: el
    // G500LS consumía 6–9 números de serie entre un latido y el próximo
    // login sin que viéramos ninguna trama; con esto se ve si esos bytes
    // llegan y cómo son, aunque el separador no los entienda.
    this.registrar({ en: new Date().toISOString(), imei: c.imei, origen: c.origen, protocolo: null, tipo: 'bytes', serie: null, crcOk: null, hex: datos.subarray(0, 160).toString('hex'), respuesta: null, posicion: null, nota: `${datos.length} bytes` });
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
    if (mensaje.tipo === 'respuesta') {
      // El texto de la respuesta queda a la vista en el registro (nota).
      this.paquetes[this.paquetes.length - 1].nota = mensaje.texto;
    }
    if (c.imei) await this.registrarEquipo(c.imei, mensaje.tipo === 'login');
    if (mensaje.tipo === 'login') this.despacharComandos(socket, c);
    if (mensaje.tipo === 'posicion' && c.imei) await this.guardarPosicion(c.imei, mensaje);
  }

  private escribirComando(socket: net.Socket, c: Conexion, texto: string) {
    const trama = comandoEnLinea(texto, this.serieComando++ & 0xffff, 1);
    socket.write(trama);
    this.registrar({ en: new Date().toISOString(), imei: c.imei, origen: c.origen, protocolo: 0x80, tipo: 'comando', serie: null, crcOk: null, hex: trama.toString('hex'), respuesta: null, posicion: null, nota: texto });
  }

  private despacharComandos(socket: net.Socket, c: Conexion) {
    if (!c.imei) return;
    const cola = this.comandosPendientes.get(c.imei);
    if (!cola || cola.length === 0) return;
    // Uno por conexión y unos segundos después del login: el G500LS recibió
    // dos comandos pegados a la respuesta del login y cortó sin contestar ni
    // latir (09-10-2026, 02:51).
    const texto = cola.shift() as string;
    if (cola.length === 0) this.comandosPendientes.delete(c.imei);
    setTimeout(() => {
      if (!socket.destroyed) this.escribirComando(socket, c, texto);
    }, ESPERA_COMANDO_MS);
  }

  /**
   * Manda un comando al equipo por el socket (los mismos textos de los SMS:
   * PARAM#, WHERE#, TIMER,10,60#…). Si está conectado sale ahora; si no,
   * queda en cola y sale apenas haga login. La respuesta aparece en el
   * registro de paquetes como tipo "respuesta", con el texto en `nota`.
   */
  enviarComando(imei: string, texto: string): { enviado: boolean; enCola: boolean } {
    for (const [socket, c] of this.conexiones) {
      if (c.imei === imei && !socket.destroyed) {
        this.escribirComando(socket, c, texto);
        return { enviado: true, enCola: false };
      }
    }
    const cola = this.comandosPendientes.get(imei) ?? [];
    cola.push(texto);
    this.comandosPendientes.set(imei, cola.slice(-10));
    return { enviado: false, enCola: true };
  }

  private registrar(p: PaqueteRegistrado) {
    this.paquetes.push(p);
    if (this.paquetes.length > MAX_PAQUETES) this.paquetes.splice(0, this.paquetes.length - MAX_PAQUETES);
  }

  private equipo(imei: string): EstadoEquipo {
    let e = this.equipos.get(imei);
    if (!e) {
      e = { imei, conectado: false, conectadoDesde: null, ultimoPaquete: null, ultimaPosicion: null, paquetes: 0, posicionesGuardadas: 0, vehiclePlate: null, eventId: null, label: null, conductorId: null, conductorNombre: null, tripId: null, ultimoError: null };
      this.equipos.set(imei, e);
    }
    return e;
  }

  // ── Equipos (telemetry.gps_devices) ─────────────────────────────────────

  private esTablaAusente(error: { code?: string; message?: string } | null): boolean {
    return Boolean(error && (error.code === '42P01' || (/gps_devices/.test(error.message ?? '') && /not find|does not exist|schema cache/i.test(error.message ?? ''))));
  }

  private async escribirEquipo(imei: string, cambios: Record<string, unknown>): Promise<boolean> {
    if (this.tablaDisponible === false) return false;
    const { error } = await this.supabase
      .schema('telemetry')
      .from('gps_devices')
      .upsert({ imei, ...cambios }, { onConflict: 'imei' });
    if (error) {
      if (this.esTablaAusente(error)) {
        this.tablaDisponible = false;
        this.logger.warn('telemetry.gps_devices no existe todavía: los equipos se ven en memoria, sin patente (scripts/gps-trackers/gps_devices.sql).');
      } else {
        this.logger.warn(`gps_devices ${imei}: ${error.message}`);
      }
      return false;
    }
    this.tablaDisponible = true;
    return true;
  }

  private async registrarEquipo(imei: string, forzar = false) {
    const ahora = Date.now();
    if (!forzar && ahora - (this.ultimoRegistro.get(imei) ?? 0) < REGISTRO_MS) return;
    this.ultimoRegistro.set(imei, ahora);
    await this.escribirEquipo(imei, { last_seen_at: new Date(ahora).toISOString() });
  }

  private async patenteDe(imei: string): Promise<string | null> {
    const cache = this.placas.get(imei);
    if (cache && Date.now() - cache.leidaEn < CACHE_PLACA_MS) return cache.plate;
    if (this.tablaDisponible === false) return null;
    const { data, error } = await this.supabase.schema('telemetry').from('gps_devices').select('plate').eq('imei', imei).maybeSingle();
    if (error) {
      if (this.esTablaAusente(error)) this.tablaDisponible = false;
      return null;
    }
    this.tablaDisponible = true;
    const plate = normalizarPatente((data as { plate?: string | null } | null)?.plate);
    this.placas.set(imei, { plate, leidaEn: Date.now() });
    return plate;
  }

  /**
   * A quién se le atribuye la posición de una patente: al conductor del
   * viaje en curso con ella; si no hay, al del viaje de hoy más cercano en
   * hora; si tampoco, al conductor cuya ficha lleva esa patente (el bus en
   * el patio sigue siendo "su" bus en el monitoreo).
   */
  private async conductorDePatente(plate: string): Promise<Atribucion> {
    const cache = this.atribuciones.get(plate);
    if (cache && Date.now() - cache.leidaEn < CACHE_ATRIBUCION_MS) return cache;
    const viajes = (await this.dataSource.query(
      `select t.id, t.driver_id, t.event_id, t.status
         from transport.trips t
        where regexp_replace(upper(coalesce(t.vehicle_plate, '')), '[^A-Z0-9]', '', 'g') = $1
          and t.status <> 'CANCELLED'
          and (t.status in ('EN_ROUTE','PICKED_UP')
               or (t.scheduled_at at time zone 'America/Santiago')::date = (now() at time zone 'America/Santiago')::date)
        order by (t.status in ('EN_ROUTE','PICKED_UP')) desc, abs(extract(epoch from (t.scheduled_at - now()))) asc
        limit 1`,
      [plate],
    )) as Array<{ id: string; driver_id: string | null; event_id: string | null; status: string }>;
    let a: Atribucion;
    const t = viajes[0];
    if (t) {
      const enCurso = t.status === 'EN_ROUTE' || t.status === 'PICKED_UP';
      a = { driverId: t.driver_id, tripId: enCurso ? t.id : null, eventId: t.event_id, leidaEn: Date.now() };
    } else {
      const fichas = (await this.dataSource.query(
        `select d.id
           from core.provider_participants d
          where d.metadata->>'isDriver' = 'true'
            and coalesce(d.status, '') <> 'DELETED'
            and regexp_replace(upper(coalesce(d.metadata->>'vehiclePatente', '')), '[^A-Z0-9]', '', 'g') = $1
          order by d.updated_at desc nulls last
          limit 1`,
        [plate],
      )) as Array<{ id: string }>;
      a = { driverId: fichas[0]?.id ?? null, tripId: null, eventId: null, leidaEn: Date.now() };
    }
    this.atribuciones.set(plate, a);
    return a;
  }

  private async guardarPosicion(imei: string, m: Extract<MensajeGt06, { tipo: 'posicion' }>) {
    const equipo = this.equipo(imei);
    const p = m.posicion;
    if (!p || !p.valido) return; // sin fijo satelital: la lat/lng es la última conocida
    // Al recuperar señal el equipo reenvía lo acumulado mezclado con lo
    // actual: la "última" posición es la más nueva, no la última en llegar.
    if (!equipo.ultimaPosicion || p.fecha >= equipo.ultimaPosicion.fecha) {
      equipo.ultimaPosicion = { ...p, recibida: new Date().toISOString() };
    }
    const punto: PuntoGuardado = { lat: p.lat, lng: p.lng, fecha: p.fecha };
    if (!valeGuardar(this.ultimaGuardada.get(imei) ?? null, punto)) return;
    this.ultimaGuardada.set(imei, punto);
    void this.escribirEquipo(imei, { last_lat: p.lat, last_lng: p.lng, last_fix_at: p.fecha.toISOString(), last_speed: p.velocidad / 3.6, last_heading: p.rumbo });
    const plate = await this.patenteDe(imei);
    equipo.vehiclePlate = plate;
    if (!plate) return; // equipo sin patente: queda a la vista en el panel para asignarlo
    const c = await this.conductorDePatente(plate);
    equipo.conductorId = c.driverId;
    equipo.tripId = c.tripId;
    equipo.eventId = c.eventId;
    if (!c.driverId) return; // sin conductor no hay a quién mostrarle el bus en el monitoreo
    const fila = {
      event_id: c.eventId,
      vehicle_id: null,
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
      this.logger.warn(`posición de ${imei} (${plate}): ${error.message}`);
      return;
    }
    equipo.ultimoError = null;
    equipo.posicionesGuardadas += 1;
  }

  // ── Panel ───────────────────────────────────────────────────────────────

  /**
   * Equipos para Monitoreo de conductores (filtro "GPS del vehículo").
   * Mezcla lo que hay en memoria con la tabla (que guarda la última posición
   * y sobrevive a los reinicios) y atribuye cada patente a su conductor.
   * `eventId` sólo acota la atribución; todos los equipos se muestran.
   */
  async listar(eventId?: string): Promise<{ puerto: number; tabla: boolean | null; equipos: EstadoEquipo[] }> {
    void eventId;
    if (this.tablaDisponible !== false) {
      const { data, error } = await this.supabase
        .schema('telemetry')
        .from('gps_devices')
        .select('imei, plate, label, last_seen_at, last_lat, last_lng, last_fix_at, last_speed, last_heading')
        .order('last_seen_at', { ascending: false, nullsFirst: false });
      if (!error && data) {
        this.tablaDisponible = true;
        for (const fila of data as FilaEquipo[]) {
          const e = this.equipo(fila.imei);
          e.vehiclePlate = normalizarPatente(fila.plate);
          e.label = fila.label;
          if (!e.ultimoPaquete && fila.last_seen_at) e.ultimoPaquete = fila.last_seen_at;
          if (fila.last_lat != null && fila.last_lng != null && fila.last_fix_at && (!e.ultimaPosicion || new Date(fila.last_fix_at) > e.ultimaPosicion.fecha)) {
            e.ultimaPosicion = { fecha: new Date(fila.last_fix_at), satelites: 0, lat: fila.last_lat, lng: fila.last_lng, velocidad: Math.round((fila.last_speed ?? 0) * 3.6), rumbo: fila.last_heading ?? 0, valido: true, recibida: fila.last_fix_at };
          }
        }
      } else if (this.esTablaAusente(error)) {
        this.tablaDisponible = false;
      }
    }
    for (const e of this.equipos.values()) {
      if (!e.vehiclePlate) {
        e.conductorId = null;
        e.tripId = null;
        continue;
      }
      const c = await this.conductorDePatente(e.vehiclePlate);
      e.conductorId = c.driverId;
      e.tripId = c.tripId;
      e.eventId = c.eventId;
    }
    const conductores = Array.from(new Set(Array.from(this.equipos.values()).map((e) => e.conductorId).filter((v): v is string => Boolean(v))));
    if (conductores.length > 0) {
      const nombres = (await this.dataSource.query(`select id, full_name from core.provider_participants where id = any($1)`, [conductores])) as Array<{ id: string; full_name: string | null }>;
      const nombrePor = new Map(nombres.map((n) => [n.id, n.full_name]));
      for (const e of this.equipos.values()) e.conductorNombre = e.conductorId ? (nombrePor.get(e.conductorId) ?? null) : null;
    }
    const equipos = Array.from(this.equipos.values()).sort((x, y) => (y.ultimoPaquete ?? '').localeCompare(x.ultimoPaquete ?? ''));
    return { puerto: this.puerto, tabla: this.tablaDisponible, equipos };
  }

  /** Patentes conocidas del evento (viajes de los últimos 30 días y fichas de sus conductores), para el selector. */
  async patentes(eventId?: string): Promise<string[]> {
    const filas = (await this.dataSource.query(
      `select distinct regexp_replace(upper(p), '[^A-Z0-9]', '', 'g') as patente
         from (
           select t.vehicle_plate as p from transport.trips t
            where ($1::uuid is null or t.event_id = $1::uuid) and t.scheduled_at > now() - interval '30 days'
           union all
           select d.metadata->>'vehiclePatente' from core.provider_participants d
            where d.metadata->>'isDriver' = 'true' and coalesce(d.status, '') <> 'DELETED'
              and ($1::uuid is null or d.id in (select driver_id from transport.trips where event_id = $1::uuid))
         ) s
        where coalesce(p, '') <> ''
        order by 1`,
      [eventId ?? null],
    )) as Array<{ patente: string }>;
    return filas.map((f) => f.patente).filter(Boolean);
  }

  ultimosPaquetes(imei?: string, limite = 100): PaqueteRegistrado[] {
    const lista = imei ? this.paquetes.filter((p) => p.imei === imei) : this.paquetes;
    return lista.slice(-limite).reverse();
  }

  async asignar(imei: string, plate: string | null, label?: string | null): Promise<EstadoEquipo> {
    const normalizada = normalizarPatente(plate);
    const { error } = await this.supabase
      .schema('telemetry')
      .from('gps_devices')
      .upsert({ imei, plate: normalizada, ...(label !== undefined ? { label } : {}) }, { onConflict: 'imei' });
    if (error) throw new Error(this.esTablaAusente(error) ? 'Falta crear telemetry.gps_devices (scripts/gps-trackers/gps_devices.sql)' : error.message);
    this.tablaDisponible = true;
    this.placas.delete(imei);
    const e = this.equipo(imei);
    e.vehiclePlate = normalizada;
    e.conductorId = null;
    e.tripId = null;
    return e;
  }
}
