/**
 * Línea de tiempo de un traslado de aeropuerto en los monitores de llegadas y
 * salidas (28-09-2026, pedido de Ariel). Cada paso se marca solo, con la hora
 * en que el conductor tocó Iniciar, Recoger o Finalizar en su app (la
 * bitácora del viaje guarda "SCHEDULED → EN_ROUTE" con su hora), y el vuelo
 * aporta el aterrizaje o el despegue.
 *
 * Llegada (Transfer In): En camino → Aterrizado → Recogido → Completado.
 * Salida (Transfer Out): En camino → Recogido → Completado → Despegó.
 */
export type ClavePaso = "EN_CAMINO" | "ATERRIZADO" | "RECOGIDO" | "COMPLETADO" | "DESPEGO";

export type PasoTraslado = {
  clave: ClavePaso;
  etiqueta: string;
  hecho: boolean;
  /** Hora ISO en que ocurrió (null si no ha ocurrido o no se sabe). */
  hora: string | null;
  /** Hora prevista, para los pasos del vuelo que aún no ocurren. */
  prevista?: string | null;
};

export type ViajeConBitacora = {
  tripType?: string | null;
  status?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  scheduledAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

const RANGO: Record<string, number> = {
  REQUESTED: 0,
  SCHEDULED: 0,
  EN_ROUTE: 1,
  PICKED_UP: 2,
  DROPPED_OFF: 3,
  COMPLETED: 3,
};

type EntradaBitacora = { action?: string; at?: string; detail?: string };

/** Primera vez que el viaje entró a alguno de esos estados, según la bitácora. */
function horaDeEstado(viaje: ViajeConBitacora, estados: string[]): string | null {
  const log = Array.isArray(viaje.metadata?.log) ? (viaje.metadata?.log as EntradaBitacora[]) : [];
  for (const e of log) {
    if (e?.action !== "STATUS_CHANGED" || !e.at || !e.detail) continue;
    const destino = String(e.detail).split("→").pop()?.trim().toUpperCase() ?? "";
    if (estados.includes(destino)) return e.at;
  }
  return null;
}

const yaPaso = (iso: string | null | undefined, ahora: Date) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t <= ahora.getTime();
};

/** Hora del vuelo: la que dejó AND en el viaje o, si no, la del viaje. */
export function horaDelVuelo(viaje: ViajeConBitacora): string | null {
  const meta = viaje.metadata ?? {};
  const delVuelo = typeof meta.flightTime === "string" ? meta.flightTime : null;
  if (delVuelo) return delVuelo;
  // Un Transfer In sin AND se programa a la hora del aterrizaje.
  return String(viaje.tripType ?? "").toUpperCase() === "TRANSFER_IN" ? viaje.scheduledAt ?? null : null;
}

export function lineaDeTraslado(viaje: ViajeConBitacora, ahora: Date = new Date()): PasoTraslado[] {
  const rango = RANGO[String(viaje.status ?? "").toUpperCase()] ?? 0;
  const enCamino = horaDeEstado(viaje, ["EN_ROUTE"]) ?? (rango >= 1 ? viaje.startedAt ?? null : null);
  const recogido = horaDeEstado(viaje, ["PICKED_UP"]) ?? (rango >= 2 && !horaDeEstado(viaje, ["EN_ROUTE"]) ? viaje.startedAt ?? null : null);
  const completado = horaDeEstado(viaje, ["DROPPED_OFF", "COMPLETED"]) ?? (rango >= 3 ? viaje.completedAt ?? null : null);
  const vuelo = horaDelVuelo(viaje);
  const esSalida = String(viaje.tripType ?? "").toUpperCase() === "TRANSFER_OUT";

  const pasoEnCamino: PasoTraslado = { clave: "EN_CAMINO", etiqueta: "En camino", hecho: rango >= 1, hora: enCamino };
  const pasoRecogido: PasoTraslado = {
    clave: "RECOGIDO",
    etiqueta: esSalida ? "Recogido en hotel" : "Recogido",
    hecho: rango >= 2,
    hora: recogido,
  };
  const pasoCompletado: PasoTraslado = {
    clave: "COMPLETADO",
    etiqueta: esSalida ? "En el aeropuerto" : "Completado",
    hecho: rango >= 3,
    hora: completado,
  };

  if (esSalida) {
    const despego = yaPaso(vuelo, ahora);
    return [
      pasoEnCamino,
      pasoRecogido,
      pasoCompletado,
      { clave: "DESPEGO", etiqueta: "Despegó", hecho: despego, hora: despego ? vuelo : null, prevista: vuelo },
    ];
  }
  // Si ya lo recogieron, el vuelo aterrizó aunque la hora prevista no haya
  // llegado (vuelo adelantado).
  const aterrizo = yaPaso(vuelo, ahora) || rango >= 2;
  return [
    pasoEnCamino,
    { clave: "ATERRIZADO", etiqueta: "Aterrizado", hecho: aterrizo, hora: aterrizo ? vuelo : null, prevista: vuelo },
    pasoRecogido,
    pasoCompletado,
  ];
}

/** El paso que sigue (el primero sin hacer), para destacarlo. */
export const pasoSiguiente = (pasos: PasoTraslado[]) => pasos.find((p) => !p.hecho)?.clave ?? null;
