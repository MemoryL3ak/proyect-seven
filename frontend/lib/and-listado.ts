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
 */
export type FilaAnd = {
  participantStatus?: string | null;
  participantMetadata?: Record<string, unknown> | null;
  participantFullName?: string | null;
  participantTripType?: string | null;
  participantFlightNumber?: string | null;
  participantArrivalTime?: string | null;
  participantDepartureFlightNumber?: string | null;
  participantDepartureTime?: string | null;
};

export type FiltroSentidoAnd = "all" | "ARRIVAL" | "DEPARTURE";
export type FiltroEstadoAnd = "" | "VALIDADO" | "PENDIENTE";

export const OPCIONES_ESTADO_AND: Array<{ value: FiltroEstadoAnd; label: string }> = [
  { value: "", label: "Todos los estados" },
  { value: "VALIDADO", label: "Validados" },
  { value: "PENDIENTE", label: "Sin validar" },
];

const tipo = (f: FilaAnd) => String(f.participantTripType ?? "").toUpperCase();

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

export function cumpleFiltroAnd(
  f: FilaAnd,
  filtro: { busqueda?: string; sentido?: FiltroSentidoAnd; estado?: FiltroEstadoAnd },
): boolean {
  if (!fichaVisibleEnAnd(f)) return false;
  const q = (filtro.busqueda ?? "").trim().toLowerCase();
  if (q && !String(f.participantFullName ?? "").toLowerCase().includes(q)) return false;
  if (filtro.sentido === "ARRIVAL" && !tieneLlegada(f)) return false;
  if (filtro.sentido === "DEPARTURE" && !tieneSalida(f)) return false;
  if (filtro.estado === "VALIDADO" && !fichaValidada(f)) return false;
  if (filtro.estado === "PENDIENTE" && fichaValidada(f)) return false;
  return true;
}

/** "2026-09-28T14:15" (campo del formulario) → "28-09 14:15". */
export function fechaHoraCorta(valor?: string | null): string {
  const m = String(valor ?? "").match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? `${m[3]}-${m[2]} ${m[4]}:${m[5]}` : "";
}
