import { isAthletePersonalDataValidated } from "./athletes";

/**
 * Listado de AND (llegadas y salidas). 28-09-2026: en World Rugby no se veía
 * ninguna ficha con vuelo. El listado mostraba sólo participantes con datos
 * personales validados —y ni siquiera leía el estado, sólo la marca de la
 * metadata—; los 23 cargados por la planilla AND estaban "Registrados". En
 * los Juegos Escolares no se notaba porque los 36 estaban validados.
 *
 * AND es la vista de quién llega y quién se va: se ven todos los del evento,
 * los pendientes con su etiqueta y un filtro por estado. Llegada y salida se
 * leen de los vuelos de la ficha (la carga AND trae los dos y sin tipo de
 * viaje), no sólo del "Tipo de viaje".
 *
 * Mismo día, más tarde: filtros por conductor, país o región, vuelo,
 * aerolínea, tipo de cliente y día, y el listado ordenado por hora de llegada
 * y agrupado por día (antes salía en el orden de carga).
 */
export type FilaAnd = {
  countryCode?: string | null;
  participantStatus?: string | null;
  participantMetadata?: Record<string, unknown> | null;
  participantFullName?: string | null;
  participantCountryCode?: string | null;
  participantUserType?: string | null;
  participantTripType?: string | null;
  participantFlightNumber?: string | null;
  participantAirline?: string | null;
  participantArrivalTime?: string | null;
  participantArrivalDriverId?: string | null;
  participantDepartureFlightNumber?: string | null;
  participantDepartureTime?: string | null;
  participantDepartureDriverId?: string | null;
};

export type FiltroSentidoAnd = "all" | "ARRIVAL" | "DEPARTURE";
export type FiltroEstadoAnd = "" | "VALIDADO" | "PENDIENTE";

/** Valor del filtro de conductor para las fichas sin conductor asignado. */
export const SIN_CONDUCTOR = "__sin__";

export type FiltrosAnd = {
  busqueda?: string;
  sentido?: FiltroSentidoAnd;
  estado?: FiltroEstadoAnd;
  /** Día "AAAA-MM-DD" de la llegada (o de la salida con "Salidas"). */
  dia?: string;
  /** id del conductor (de llegada o de salida), o SIN_CONDUCTOR. */
  conductor?: string;
  pais?: string;
  vuelo?: string;
  aerolinea?: string;
  tipoCliente?: string;
};

export const OPCIONES_ESTADO_AND: Array<{ value: FiltroEstadoAnd; label: string }> = [
  { value: "", label: "Todos los estados" },
  { value: "VALIDADO", label: "Validados" },
  { value: "PENDIENTE", label: "Sin validar" },
];

const tipo = (f: FilaAnd) => String(f.participantTripType ?? "").toUpperCase();
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const vueloNormal = (v: unknown) => texto(v).replace(/\s+/g, "").toUpperCase();
const salidaMeta = (f: FilaAnd) => {
  const d = f.participantMetadata?.departure;
  return (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
};

/** Una ficha dada de baja no es parte del listado. */
export const fichaVisibleEnAnd = (f: FilaAnd) => String(f.participantStatus ?? "").toUpperCase() !== "DELETED";

export const fichaValidada = (f: FilaAnd) =>
  isAthletePersonalDataValidated({ status: f.participantStatus ?? null, metadata: f.participantMetadata ?? null });

export function tieneLlegada(f: FilaAnd): boolean {
  if (tipo(f) === "ARRIVAL") return true;
  if (tipo(f) === "DEPARTURE") return false;
  return Boolean(f.participantArrivalTime || f.participantFlightNumber);
}

export function tieneSalida(f: FilaAnd): boolean {
  if (tipo(f) === "DEPARTURE") return true;
  if (tipo(f) === "ARRIVAL") return false;
  return Boolean(f.participantDepartureTime || f.participantDepartureFlightNumber);
}

/** País o región de la ficha: el de su delegación o, si no, el suyo. */
export const paisDe = (f: FilaAnd) => texto(f.countryCode) || texto(f.participantCountryCode);

/** Vuelos de la ficha (llegada y salida), normalizados: "LA 1324" = "LA1324". */
export function vuelosDe(f: FilaAnd): string[] {
  const vuelos = [
    tieneLlegada(f) ? vueloNormal(f.participantFlightNumber) : "",
    tieneSalida(f) ? vueloNormal(f.participantDepartureFlightNumber) : "",
  ].filter(Boolean);
  return Array.from(new Set(vuelos));
}

export function aerolineasDe(f: FilaAnd): string[] {
  const lista = [
    tieneLlegada(f) ? texto(f.participantAirline) : "",
    tieneSalida(f) ? texto(salidaMeta(f).airline) : "",
  ].filter(Boolean);
  return Array.from(new Set(lista));
}

export function conductoresDe(f: FilaAnd): string[] {
  const lista = [
    tieneLlegada(f) ? texto(f.participantArrivalDriverId) : "",
    tieneSalida(f) ? texto(f.participantDepartureDriverId) : "",
  ].filter(Boolean);
  return Array.from(new Set(lista));
}

/**
 * Hora que ordena la ficha: la llegada (o la salida si se filtran salidas o
 * si sólo tiene salida). Formato del formulario, "AAAA-MM-DDTHH:mm" en hora de
 * Chile, que se ordena como texto. "" = sin hora.
 */
export function horaParaOrdenar(f: FilaAnd, sentido: FiltroSentidoAnd = "all"): string {
  if (sentido === "DEPARTURE") return texto(f.participantDepartureTime);
  if (tieneLlegada(f) && texto(f.participantArrivalTime)) return texto(f.participantArrivalTime);
  return texto(f.participantDepartureTime);
}

/** Día (AAAA-MM-DD) con que se agrupa la ficha; "" = sin fecha. */
export const diaDe = (f: FilaAnd, sentido: FiltroSentidoAnd = "all") => horaParaOrdenar(f, sentido).slice(0, 10);

export function cumpleFiltroAnd(f: FilaAnd, filtro: FiltrosAnd): boolean {
  if (!fichaVisibleEnAnd(f)) return false;
  const q = (filtro.busqueda ?? "").trim().toLowerCase();
  if (q && !String(f.participantFullName ?? "").toLowerCase().includes(q)) return false;
  if (filtro.sentido === "ARRIVAL" && !tieneLlegada(f)) return false;
  if (filtro.sentido === "DEPARTURE" && !tieneSalida(f)) return false;
  if (filtro.estado === "VALIDADO" && !fichaValidada(f)) return false;
  if (filtro.estado === "PENDIENTE" && fichaValidada(f)) return false;
  if (filtro.dia && diaDe(f, filtro.sentido) !== filtro.dia) return false;
  if (filtro.conductor) {
    const suyos = conductoresDe(f);
    if (filtro.conductor === SIN_CONDUCTOR ? suyos.length > 0 : !suyos.includes(filtro.conductor)) return false;
  }
  if (filtro.pais && paisDe(f) !== filtro.pais) return false;
  if (filtro.vuelo && !vuelosDe(f).includes(vueloNormal(filtro.vuelo))) return false;
  if (filtro.aerolinea && !aerolineasDe(f).includes(filtro.aerolinea)) return false;
  if (filtro.tipoCliente && texto(f.participantUserType) !== filtro.tipoCliente) return false;
  return true;
}

/** Por hora (la más temprana primero); las fichas sin hora al final, por nombre. */
export function ordenarAnd<T extends FilaAnd>(filas: T[], sentido: FiltroSentidoAnd = "all"): T[] {
  return [...filas].sort((a, b) => {
    const ha = horaParaOrdenar(a, sentido);
    const hb = horaParaOrdenar(b, sentido);
    if (ha && hb && ha !== hb) return ha.localeCompare(hb);
    if (ha && !hb) return -1;
    if (!ha && hb) return 1;
    return String(a.participantFullName ?? "").localeCompare(String(b.participantFullName ?? ""), "es");
  });
}

/** Grupos por día, en orden; el grupo "" (sin fecha) va al final. */
export function agruparPorDia<T extends FilaAnd>(filas: T[], sentido: FiltroSentidoAnd = "all"): Array<{ dia: string; filas: T[] }> {
  const grupos: Array<{ dia: string; filas: T[] }> = [];
  for (const fila of ordenarAnd(filas, sentido)) {
    const dia = diaDe(fila, sentido);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.filas.push(fila);
    else grupos.push({ dia, filas: [fila] });
  }
  return grupos;
}

/** Valores distintos presentes en las fichas, para las opciones de cada filtro. */
export function valoresAnd(filas: FilaAnd[], sentido: FiltroSentidoAnd = "all") {
  const unicos = (lista: string[]) => Array.from(new Set(lista.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
  return {
    dias: unicos(filas.map((f) => diaDe(f, sentido))),
    conductores: unicos(filas.flatMap(conductoresDe)),
    haySinConductor: filas.some((f) => (tieneLlegada(f) || tieneSalida(f)) && conductoresDe(f).length === 0),
    paises: unicos(filas.map(paisDe)),
    vuelos: unicos(filas.flatMap(vuelosDe)),
    aerolineas: unicos(filas.flatMap(aerolineasDe)),
    tiposCliente: unicos(filas.map((f) => texto(f.participantUserType))),
  };
}

/** "2026-09-28T14:15" (campo del formulario) → "28-09 14:15". */
export function fechaHoraCorta(valor?: string | null): string {
  const m = String(valor ?? "").match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? `${m[3]}-${m[2]} ${m[4]}:${m[5]}` : "";
}
