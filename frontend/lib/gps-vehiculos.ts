/**
 * Equipos GPS de vehículo (rastreadores OBD, GET /gps-trackers) tal como los
 * muestra Monitoreo de conductores: estado, rótulo y marcador del mapa.
 * 09-10-2026: la posición del bus deja de depender del teléfono del
 * conductor; el filtro "Fuente" del monitoreo permite ver sólo estos equipos.
 */
import type { PresenceMarker } from "@/components/DriverPresenceMap";
import { STATE, SURFACE } from "@/lib/design";

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

/**
 * Modelo del equipo para mostrar. El SEG-9888G (JT808) se reconoce también
 * por su identificador de 12 dígitos: tras un reinicio del servidor, hasta
 * que el equipo vuelve a registrarse, no se sabe su protocolo y salía como
 * "Rastreador GT06" (13-10-2026).
 */
export function modeloEquipo(e: Pick<EquipoGps, "modelo" | "protocolo" | "imei">): string {
  const declarado = e.modelo?.trim().split(" ")[0];
  if (declarado) return declarado;
  if (e.protocolo === "JT808" || e.imei.length === 12) return "SEG-9888G";
  return e.protocolo === "GT06" || e.imei.length === 15 ? "Rastreador GT06" : "Rastreador GPS";
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

export type PosicionRapida = { imei: string; conectado: boolean; ultimoPaquete: string | null; posicion: Omit<PosicionEquipo, "extras" | "contacto"> };

/**
 * Mete las posiciones del sondeo rápido (GET /gps-trackers/posiciones, cada
 * 2 s) en la lista de equipos que trae el sondeo completo (cada 8 s): sólo
 * cambia la posición, y sólo si es más nueva que la que ya se tiene; los
 * datos OBD y el contacto de la posición anterior se conservan.
 */
export function fusionarPosiciones(equipos: EquipoGps[], rapidas: PosicionRapida[]): EquipoGps[] {
  if (rapidas.length === 0) return equipos;
  const por = new Map(rapidas.map((r) => [r.imei, r]));
  let cambio = false;
  const nuevos = equipos.map((e) => {
    const r = por.get(e.imei);
    if (!r) return e;
    const actual = e.ultimaPosicion;
    if (actual && new Date(r.posicion.recibida).getTime() <= new Date(actual.recibida).getTime()) return e;
    cambio = true;
    return { ...e, ultimoPaquete: r.ultimoPaquete ?? e.ultimoPaquete, ultimaPosicion: { ...(actual ?? {}), ...r.posicion } as PosicionEquipo };
  });
  return cambio ? nuevos : equipos;
}

/**
 * La lista completa (cada 8 s) reemplaza a la anterior, pero sin retroceder
 * la posición: si el sondeo rápido ya trajo una más nueva para ese equipo,
 * se conserva (la respuesta lenta puede llegar después de la rápida).
 */
export function fusionarListas(prev: EquipoGps[], nuevos: EquipoGps[]): EquipoGps[] {
  const por = new Map(prev.map((e) => [e.imei, e]));
  return nuevos.map((n) => {
    const p = por.get(n.imei);
    if (!p?.ultimaPosicion) return n;
    if (n.ultimaPosicion && new Date(n.ultimaPosicion.recibida).getTime() >= new Date(p.ultimaPosicion.recibida).getTime()) return n;
    return { ...n, ultimaPosicion: p.ultimaPosicion, ultimoPaquete: [n.ultimoPaquete, p.ultimoPaquete].filter(Boolean).sort().pop() ?? n.ultimoPaquete };
  });
}

/**
 * Un solo pin por auto (13-10-2026, Ariel: "se ven los 2 GPS, del celular y
 * del dispositivo físico, entonces se duplica"). Cuando un equipo está
 * atribuido a un conductor (por la patente del viaje o de su ficha):
 * - si el equipo tiene señal, manda el equipo y se oculta el pin del celular;
 * - si el equipo está mudo y el celular sí reporta, manda el celular;
 * - si ninguno reporta, queda el equipo (su última posición).
 */
export function unirMarcadores(conductores: PresenceMarker[], equipos: EquipoGps[], ahoraMs: number): PresenceMarker[] {
  const porConductor = new Map(conductores.map((m) => [m.id, m]));
  const ocultos = new Set<string>();
  const deEquipos: PresenceMarker[] = [];
  for (const e of equipos) {
    const m = marcadorDeEquipo(e, ahoraMs);
    if (!m) continue;
    const celular = e.conductorId ? porConductor.get(e.conductorId) : undefined;
    if (celular) {
      if (!estadoDeEquipo(e, ahoraMs).gpsVivo && celular.online) continue;
      ocultos.add(celular.id);
    }
    deEquipos.push(m);
  }
  return [...conductores.filter((m) => !ocultos.has(m.id)), ...deEquipos];
}

/**
 * Lo que informa el vehículo en una línea corta para la tabla: contacto y,
 * en los equipos OBD, motor, temperatura, batería, odómetro y combustible.
 */
export function lineaEstadoVehiculo(e: EquipoGps): string {
  const p = e.ultimaPosicion;
  const x = p?.extras;
  const contacto = e.contacto ?? p?.contacto ?? null;
  const partes: string[] = [];
  if (contacto != null) partes.push(contacto ? "Contacto puesto" : "Contacto apagado");
  if (x?.rpm != null) partes.push(x.rpm > 0 ? `${x.rpm} rpm` : "motor apagado");
  if (x?.temperaturaMotor != null) partes.push(`${Math.round(x.temperaturaMotor)} °C`);
  if (x?.voltaje != null) partes.push(`${x.voltaje.toFixed(1).replace(".", ",")} V`);
  if (x?.kmObd != null) partes.push(`${miles(x.kmObd)} km`);
  if (x?.combustiblePct != null) partes.push(`${Math.round(x.combustiblePct)} % comb.`);
  if (e.energiaExterna === false) partes.push("con batería interna");
  return partes.join(" · ");
}

/** Cuántos equipos hay en cada situación, para el encabezado de la sección. */
export function resumenEquipos(equipos: EquipoGps[], ahoraMs: number): Record<Situacion["tono"], number> & { sinPatente: number } {
  const r = { movimiento: 0, motor: 0, detenido: 0, sinConexion: 0, sinPatente: 0 };
  for (const e of equipos) {
    r[situacionEquipo(e, ahoraMs).tono] += 1;
    if (!e.vehiclePlate) r.sinPatente += 1;
  }
  return r;
}

/**
 * Orden de las tarjetas: primero los conectados, después por nombre. No se
 * ordena por velocidad ni por situación fina para que las tarjetas no salten
 * de lugar cada 2 s.
 */
export function ordenarEquipos(equipos: EquipoGps[], ahoraMs: number): EquipoGps[] {
  return [...equipos].sort((a, b) => {
    const ca = estadoDeEquipo(a, ahoraMs).conectado ? 0 : 1;
    const cb = estadoDeEquipo(b, ahoraMs).conectado ? 0 : 1;
    return ca - cb || nombreEquipo(a).localeCompare(nombreEquipo(b), "es");
  });
}

/** Patente como la guarda el servidor: mayúsculas, sólo letras y números. */
export const normalizarPatente = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Lo que muestra el selector de patente mientras se escribe: las patentes
 * conocidas que calzan (sin la actual) y, si lo escrito no existe todavía,
 * la opción de usarlo como patente nueva (desde 4 caracteres).
 */
export function opcionesPatente(conocidas: string[], actual: string | null, texto: string): { lista: string[]; nueva: string | null } {
  const q = normalizarPatente(texto);
  const unicas = Array.from(new Set(conocidas.map(normalizarPatente).filter(Boolean)));
  const lista = unicas.filter((p) => p !== actual && (!q || p.includes(q)));
  const nueva = q.length >= 4 && q.length <= 8 && !unicas.includes(q) && q !== actual ? q : null;
  return { lista, nueva };
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

/** Color de cada situación en el pin del mapa (los mismos tonos de la tabla). */
export const COLOR_SITUACION: Record<Situacion["tono"], string> = {
  movimiento: STATE.success,
  motor: STATE.warning,
  detenido: STATE.info,
  sinConexion: SURFACE.textFaint,
};

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

const horaCorta = (iso: string) => new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export type Indicador = { valor: string; unidad: string | null; label: string };

/**
 * La ficha del vehículo que se abre al pinchar un GPS en el mapa (rehecha el
 * 11-10-2026, Ariel: "diseño horrible"): cabecera oscura con la patente, el
 * nombre, marca y modelo, la situación y hace cuánto habló; hasta tres
 * indicadores grandes (velocidad, motor, combustible…); detalles en dos
 * columnas; y al pie el identificador del equipo, señal y última posición.
 */
export type FichaVehiculo = {
  nombre: string;
  subtitulo: string;
  /** Texto del recuadro de la cabecera: la patente o "GPS". */
  insignia: string;
  situacion: Situacion;
  /** Hace cuánto llegó el último paquete. */
  actualizado: string;
  indicadores: Indicador[];
  detalles: { label: string; value: string }[];
  pie: string[];
};

export function fichaVehiculo(e: EquipoGps, ahoraMs: number): FichaVehiculo {
  const estado = estadoDeEquipo(e, ahoraMs);
  const p = e.ultimaPosicion;
  const x = p?.extras;
  const marca = marcaDeVin(x?.vin);
  const modelo = modeloEquipo(e);
  const contacto = e.contacto ?? p?.contacto ?? null;

  const indicadores: Indicador[] = [];
  if (p) indicadores.push({ valor: String(Math.round(p.velocidad)), unidad: "km/h", label: "Velocidad" });
  if (x?.rpm != null) indicadores.push({ valor: String(x.rpm), unidad: "rpm", label: "Motor" });
  if (x?.combustiblePct != null) indicadores.push({ valor: String(Math.round(x.combustiblePct)), unidad: "%", label: "Combustible" });
  else if (x?.voltaje != null) indicadores.push({ valor: x.voltaje.toFixed(1).replace(".", ","), unidad: "V", label: "Batería" });
  if (indicadores.length < 3 && p && p.satelites > 0) indicadores.push({ valor: String(p.satelites), unidad: "sat.", label: "GPS" });
  if (indicadores.length < 3 && e.senalPct != null) indicadores.push({ valor: String(e.senalPct), unidad: "%", label: "Señal" });

  const detalles = [
    { label: "Conductor", value: e.conductorNombre ?? "sin conductor" },
    { label: "Viaje", value: e.tripId ? "En viaje" : "Sin viaje" },
    ...(contacto != null ? [{ label: "Contacto", value: contacto ? "puesto" : "apagado" }] : []),
    ...(x?.velocidadObd != null ? [{ label: "Velocidad del auto", value: `${Math.round(x.velocidadObd)} km/h` }] : []),
    ...(x?.temperaturaMotor != null ? [{ label: "Temp. motor", value: `${Math.round(x.temperaturaMotor)} °C` }] : []),
    ...(x?.voltaje != null ? [{ label: "Batería", value: `${x.voltaje.toFixed(1).replace(".", ",")} V` }] : []),
    ...(x?.kmObd != null ? [{ label: "Odómetro", value: `${miles(x.kmObd)} km` }] : []),
    ...(e.energiaExterna != null ? [{ label: "Energía", value: e.energiaExterna ? "del vehículo" : "batería interna" }] : []),
    ...(x?.vin ? [{ label: "VIN", value: x.vin }] : []),
  ];

  const equipo = [
    `${e.protocolo === "JT808" ? "ID" : "IMEI"} ${e.imei}`,
    ...(e.senalPct != null ? [`señal ${e.senalPct} %`] : []),
    ...(p && p.satelites > 0 && indicadores.every((i) => i.label !== "GPS") ? [`${p.satelites} sat.`] : []),
  ].join(" · ");

  return {
    nombre: nombreEquipo(e),
    subtitulo: [marca, modelo].filter(Boolean).join(" · "),
    insignia: e.vehiclePlate ?? "GPS",
    situacion: situacionEquipo(e, ahoraMs),
    actualizado: hace(estado.edadPaqueteS),
    indicadores: indicadores.slice(0, 3),
    detalles,
    pie: [equipo, p ? `Última posición ${horaCorta(p.fecha)} · ${hace(estado.edadGpsS)}` : "Sin posición todavía"],
  };
}

/** Id del marcador de un equipo en el mapa (la tabla lo usa para "ver en el mapa"). */
export const idMarcadorEquipo = (imei: string) => `gps:${imei}`;

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
    id: idMarcadorEquipo(e.imei),
    lat: p.lat,
    lng: p.lng,
    name: nombreEquipo(e),
    // Con patente, el pin es una placa con la patente (13-10-2026); sin ella, el círculo con "GPS".
    iniciales: e.vehiclePlate ?? "GPS",
    pinPatente: e.vehiclePlate ?? null,
    // El color del pin es el de su situación, el mismo de la tabla.
    color: COLOR_SITUACION[situacionEquipo(e, ahoraMs).tono],
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
    fichaVehiculo: fichaVehiculo(e, ahoraMs),
  };
}
