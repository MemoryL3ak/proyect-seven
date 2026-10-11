/**
 * Equipos GPS de vehículo (rastreadores OBD, GET /gps-trackers) tal como los
 * muestra Monitoreo de conductores: estado, rótulo y marcador del mapa.
 * 09-10-2026: la posición del bus deja de depender del teléfono del
 * conductor; el filtro "Fuente" del monitoreo permite ver sólo estos equipos.
 */
import type { PresenceMarker } from "@/components/DriverPresenceMap";

/**
 * Datos del vehículo que agregan los equipos OBD que hablan JT808 (SEG-9888G,
 * 11-10-2026): lo que lee del computador del auto con el motor encendido.
 * Mismos nombres que ExtrasVehiculo en src/gps-trackers/gt06.ts.
 */
export type ExtrasVehiculo = {
  odometroEquipoKm?: number;
  senal?: number;
  voltaje?: number;
  rpm?: number;
  velocidadObd?: number;
  temperaturaMotor?: number;
  temperaturaAdmision?: number;
  cargaMotor?: number;
  kmObd?: number;
  combustiblePct?: number;
  vin?: string;
  iccid?: string;
  crudos?: Record<string, string>;
};

export type PosicionEquipo = {
  fecha: string;
  satelites: number;
  lat: number;
  lng: number;
  /** km/h, por GPS. */
  velocidad: number;
  rumbo: number;
  valido: boolean;
  recibida: string;
  /** Contacto puesto según el equipo (JT808). */
  contacto?: boolean | null;
  extras?: ExtrasVehiculo | null;
};

export type EquipoGps = {
  /** IMEI (GT06) o teléfono/ID del terminal (JT808). */
  imei: string;
  protocolo?: "GT06" | "JT808" | null;
  modelo?: string | null;
  conectado: boolean;
  conectadoDesde: string | null;
  ultimoPaquete: string | null;
  ultimaPosicion: PosicionEquipo | null;
  paquetes: number;
  posicionesGuardadas: number;
  /** Patente asignada (normalizada); los viajes identifican al vehículo por patente. */
  vehiclePlate: string | null;
  eventId: string | null;
  label: string | null;
  conductorId: string | null;
  conductorNombre: string | null;
  tripId: string | null;
  ultimoError: string | null;
  /** Del último latido (GT06) o posición (JT808): contacto puesto y si lo alimenta el auto. */
  contacto?: boolean | null;
  energiaExterna?: boolean | null;
  /** Señal celular y batería interna, 0–100. */
  senalPct?: number | null;
  bateriaPct?: number | null;
};

/** Sin paquete en 5 minutos, el equipo está sin conexión. */
export const VENTANA_EQUIPO_CONECTADO_MS = 5 * 60 * 1000;
/** Detenido reporta cada 60 s (TIMER,10,60): 3 minutos sin posición es señal perdida. */
export const VENTANA_GPS_EQUIPO_MS = 3 * 60 * 1000;

export type EstadoEquipo = {
  conectado: boolean;
  gpsVivo: boolean;
  /** Segundos desde la última posición recibida; null si nunca mandó una. */
  edadGpsS: number | null;
  edadPaqueteS: number | null;
};

const edad = (iso: string | null | undefined, ahoraMs: number): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.round((ahoraMs - t) / 1000)) : null;
};

export function estadoDeEquipo(e: EquipoGps, ahoraMs: number): EstadoEquipo {
  const edadPaqueteS = edad(e.ultimoPaquete, ahoraMs);
  const edadGpsS = edad(e.ultimaPosicion?.recibida, ahoraMs);
  return {
    conectado: edadPaqueteS != null && edadPaqueteS * 1000 < VENTANA_EQUIPO_CONECTADO_MS,
    gpsVivo: edadGpsS != null && edadGpsS * 1000 < VENTANA_GPS_EQUIPO_MS,
    edadGpsS,
    edadPaqueteS,
  };
}

/** Patente si tiene vehículo; si no, el modelo o "GPS" con los últimos 6 del identificador. */
export function nombreEquipo(e: EquipoGps): string {
  return e.vehiclePlate?.trim() || e.label?.trim() || `${e.modelo?.trim().split(" ")[0] || "GPS"} ·${e.imei.slice(-6)}`;
}

export function hace(segundos: number | null): string {
  if (segundos == null) return "—";
  if (segundos < 60) return `hace ${segundos}s`;
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`;
  return `hace ${Math.floor(segundos / 86400)} d`;
}

const miles = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Lo que el auto informa por OBD, en el orden en que se muestra: velocidad del
 * tablero, motor, temperatura, batería, kilometraje y combustible. Vacío para
 * los equipos que sólo mandan GPS (G500LS) o con el motor apagado.
 */
export function datosVehiculo(p: PosicionEquipo | null | undefined): { label: string; value: string }[] {
  const x = p?.extras;
  if (!x) return [];
  const filas: { label: string; value: string }[] = [];
  if (x.velocidadObd != null) filas.push({ label: "Velocidad (auto)", value: `${Math.round(x.velocidadObd)} km/h` });
  if (x.rpm != null) filas.push({ label: "Motor", value: x.rpm > 0 ? `${x.rpm} rpm` : "apagado" });
  if (x.temperaturaMotor != null) filas.push({ label: "Temp. motor", value: `${Math.round(x.temperaturaMotor)} °C` });
  if (x.voltaje != null) filas.push({ label: "Batería", value: `${x.voltaje.toFixed(1).replace(".", ",")} V` });
  if (x.kmObd != null) filas.push({ label: "Odómetro", value: `${miles(x.kmObd)} km` });
  if (x.combustiblePct != null) filas.push({ label: "Combustible", value: `${Math.round(x.combustiblePct)} %` });
  return filas;
}

/** Marca a partir de los tres primeros caracteres del VIN (código de fabricante). */
const MARCAS_VIN: Record<string, string> = {
  ZFA: "Fiat", "9BD": "Fiat", "8AP": "Fiat",
  WVW: "Volkswagen", WV1: "Volkswagen", WV2: "Volkswagen", "9BW": "Volkswagen", "3VW": "Volkswagen", "8AW": "Volkswagen", LSV: "Volkswagen",
  KMH: "Hyundai", KMF: "Hyundai", KMJ: "Hyundai", KNA: "Kia", KNM: "Kia", KND: "Kia",
  JTD: "Toyota", JTE: "Toyota", JTM: "Toyota", JTN: "Toyota", JTH: "Lexus", MR0: "Toyota", "8AJ": "Toyota", "9BR": "Toyota", MHF: "Toyota",
  "1HG": "Honda", "2HG": "Honda", JHM: "Honda", "93H": "Honda",
  MA3: "Suzuki", JS2: "Suzuki", JS3: "Suzuki",
  JN1: "Nissan", JN8: "Nissan", "3N1": "Nissan", "3N6": "Nissan", "94D": "Nissan", MNT: "Nissan",
  MMB: "Mitsubishi", MMC: "Mitsubishi", JA3: "Mitsubishi", JMY: "Mitsubishi",
  WBA: "BMW", WBS: "BMW", WBY: "BMW", WDD: "Mercedes-Benz", WDB: "Mercedes-Benz", WDC: "Mercedes-Benz", WDF: "Mercedes-Benz", W1K: "Mercedes-Benz", W1V: "Mercedes-Benz", "8AC": "Mercedes-Benz",
  YV1: "Volvo", YV4: "Volvo", VF1: "Renault", "8A1": "Renault", "93Y": "Renault", VF3: "Peugeot", VR3: "Peugeot", VF7: "Citroën", VR7: "Citroën", WAU: "Audi", TRU: "Audi",
  "1FA": "Ford", "1FT": "Ford", "1FM": "Ford", "3FA": "Ford", "9BF": "Ford", WF0: "Ford", "8AF": "Ford", MAJ: "Ford", MNB: "Ford",
  "1G1": "Chevrolet", "1GC": "Chevrolet", KL1: "Chevrolet", KL8: "Chevrolet", "9BG": "Chevrolet", "8AG": "Chevrolet", LZW: "Chevrolet", "3GN": "Chevrolet", "3GC": "Chevrolet",
  MPA: "Isuzu", JAA: "Isuzu", MP1: "Isuzu",
  LGX: "BYD", LC0: "BYD", LJ1: "JAC", L6T: "Geely", LB3: "Geely", LVV: "Chery", LGW: "Great Wall", LGB: "Nissan", LSJ: "MG", LSG: "Chevrolet", LMG: "GAC", LDC: "Dongfeng", LFV: "Volkswagen",
  SAL: "Land Rover", ZAR: "Alfa Romeo", VSS: "Seat", TMB: "Škoda", WP0: "Porsche", JF1: "Subaru", "4S4": "Subaru", JM1: "Mazda", JMZ: "Mazda", "3MZ": "Mazda", MM8: "Mazda",
  "1C4": "Jeep", "1J4": "Jeep", ZAC: "Jeep", "3C4": "Jeep", "5YJ": "Tesla", LRW: "Tesla", KPT: "SsangYong", NMT: "Toyota", NLH: "Hyundai",
};

export function marcaDeVin(vin: string | null | undefined): string | null {
  if (!vin || vin.length < 3) return null;
  return MARCAS_VIN[vin.slice(0, 3).toUpperCase()] ?? null;
}

export type Situacion = { texto: string; tono: "movimiento" | "motor" | "detenido" | "sinConexion" };

/**
 * Qué está haciendo el vehículo, en una frase: en movimiento, detenido con el
 * motor encendido (contacto o rpm), detenido, o sin conexión. Es el titular
 * de la ficha del equipo en el mapa (11-10-2026).
 */
export function situacionEquipo(e: EquipoGps, ahoraMs: number): Situacion {
  const estado = estadoDeEquipo(e, ahoraMs);
  if (!estado.conectado) return { texto: "Sin conexión", tono: "sinConexion" };
  const p = e.ultimaPosicion;
  if (estado.gpsVivo && p && p.velocidad >= 3) return { texto: "En movimiento", tono: "movimiento" };
  const motor = (p?.extras?.rpm ?? 0) > 0 || e.contacto === true || p?.contacto === true;
  if (motor) return { texto: "Detenido, motor encendido", tono: "motor" };
  if (!estado.gpsVivo) return { texto: "Conectado, sin señal GPS", tono: "detenido" };
  return { texto: "Detenido", tono: "detenido" };
}

export type SeccionFicha = { titulo: string; filas: { label: string; value: string }[] };

const horaCorta = (iso: string) => new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * La ficha del equipo en el mapa, por secciones: el vehículo (patente, marca,
 * conductor, viaje), lo que pasa ahora (velocidad, motor, combustible…) y el
 * equipo (modelo, identificador, señal, última posición y conexión).
 */
export function fichaEquipo(e: EquipoGps, ahoraMs: number): SeccionFicha[] {
  const estado = estadoDeEquipo(e, ahoraMs);
  const p = e.ultimaPosicion;
  const x = p?.extras;
  const marca = marcaDeVin(x?.vin);
  const contacto = e.contacto ?? p?.contacto ?? null;
  const vehiculo = [
    { label: "Patente", value: e.vehiclePlate ?? "sin asignar" },
    ...(marca ? [{ label: "Marca", value: marca }] : []),
    ...(x?.vin ? [{ label: "VIN", value: x.vin }] : []),
    { label: "Conductor", value: e.conductorNombre ?? "—" },
    { label: "Viaje", value: e.tripId ? "En viaje" : "Sin viaje en curso" },
  ];
  const ahora = [
    ...(p ? [{ label: "Velocidad GPS", value: `${Math.round(p.velocidad)} km/h` }] : []),
    ...datosVehiculo(p),
    ...(contacto != null ? [{ label: "Contacto", value: contacto ? "puesto" : "apagado" }] : []),
  ];
  const equipo = [
    { label: "Equipo", value: e.modelo?.trim().split(" ")[0] || (e.protocolo === "JT808" ? "SEG-9888G" : "Rastreador GT06") },
    { label: e.protocolo === "JT808" ? "ID" : "IMEI", value: e.imei },
    ...(e.senalPct != null ? [{ label: "Señal celular", value: `${e.senalPct} %` }] : []),
    ...(p && p.satelites > 0 ? [{ label: "Satélites", value: String(p.satelites) }] : []),
    { label: "Última posición", value: p ? `${horaCorta(p.fecha)} · ${hace(estado.edadGpsS)}` : "nunca" },
    { label: "Última conexión", value: hace(estado.edadPaqueteS) },
    ...(e.energiaExterna != null ? [{ label: "Energía", value: e.energiaExterna ? "del vehículo" : "batería interna" }] : []),
  ];
  return [
    { titulo: "Vehículo", filas: vehiculo },
    { titulo: "Ahora", filas: ahora },
    { titulo: "Equipo", filas: equipo },
  ].filter((s) => s.filas.length > 0);
}

/** Marcador del mapa; null si el equipo nunca mandó una posición. */
export function marcadorDeEquipo(e: EquipoGps, ahoraMs: number): PresenceMarker | null {
  const p = e.ultimaPosicion;
  if (!p) return null;
  const estado = estadoDeEquipo(e, ahoraMs);
  const detailRows: { label: string; value: string }[] = [
    { label: "IMEI", value: e.imei },
    { label: "Vehículo", value: e.vehiclePlate ?? "sin asignar" },
    ...(e.conductorNombre ? [{ label: "Conductor", value: e.conductorNombre }] : []),
    { label: "Velocidad", value: `${Math.round(p.velocidad)} km/h` },
    ...datosVehiculo(p),
    ...(p.extras?.vin ? [{ label: "VIN", value: p.extras.vin }] : []),
  ];
  return {
    id: `gps:${e.imei}`,
    lat: p.lat,
    lng: p.lng,
    name: nombreEquipo(e),
    // En el pin: la patente, o "GPS" mientras no la tenga.
    iniciales: e.vehiclePlate ? e.vehiclePlate.slice(0, 4) : "GPS",
    online: estado.gpsVivo,
    conectado: estado.conectado,
    onTrip: Boolean(e.tripId) && estado.gpsVivo,
    tripLabel: e.tripId ? "En viaje" : null,
    estadoTexto: situacionEquipo(e, ahoraMs).texto,
    lastSeen: hace(estado.edadPaqueteS),
    gpsTime: horaCorta(p.fecha),
    activeTrips: e.tripId ? 1 : 0,
    platform: "gps-vehiculo",
    clientTypes: [],
    detailRows,
    secciones: fichaEquipo(e, ahoraMs),
  };
}
