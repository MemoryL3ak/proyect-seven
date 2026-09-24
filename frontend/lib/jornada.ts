/**
 * Inicio de la jornada de un conductor: el primer viaje iniciado del día.
 *
 * Sólo cuenta un viaje que de verdad está o estuvo en marcha. Un viaje que
 * volvió a Programado conserva `startedAt` de cuando se inició por error (el
 * 22-09 un conductor pasó dos viajes de Programado a Completado en un minuto
 * y el panel los devolvió a Programado), y ese dato viejo arrancaba el reloj
 * de 13 h desde la tarde anterior.
 *
 * Un viaje en marcha o cerrado SIN `startedAt` también cuenta: hasta el
 * 23-09 el portal sólo marcaba el inicio al subir el pasajero, así que un
 * viaje "En ruta" no tenía inicio y el conductor figuraba "Sin iniciar" con
 * el bus andando. Para esos se toma la mejor marca que haya: cierre, última
 * modificación o, si no hay otra, la hora programada.
 */
const SIN_INICIAR = new Set(["SCHEDULED", "REQUESTED", "CANCELLED"]);

export type ViajeJornada = {
  status?: string | null;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  scheduledAt?: string | Date | null;
};

const fecha = (v: string | Date | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Inicio de un viaje en marcha o cerrado; sin `startedAt`, la marca más temprana disponible. */
export function inicioDeViaje(v: ViajeJornada): Date | null {
  const directo = fecha(v.startedAt);
  if (directo) return directo;
  const candidatos = [fecha(v.completedAt), fecha(v.updatedAt), fecha(v.scheduledAt)].filter(
    (d): d is Date => !!d,
  );
  if (candidatos.length === 0) return null;
  return candidatos.sort((a, b) => a.getTime() - b.getTime())[0];
}

/** Fechas de inicio válidas, de la más antigua a la más nueva. */
export function iniciosDeJornada(viajes: ViajeJornada[]): Date[] {
  return viajes
    .filter((v) => !SIN_INICIAR.has(v.status ?? ""))
    .map(inicioDeViaje)
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime());
}

export function inicioDeJornada(viajes: ViajeJornada[]): Date | null {
  return iniciosDeJornada(viajes)[0] ?? null;
}

/* ─── Jornada de 13 h ──────────────────────────────────────────────────────
 * Regla del Control de jornada (panel de conductores): arranca con el primer
 * viaje iniciado del día. Al cumplirse el plazo no se corta: sigue como horas
 * extra mientras al conductor le quede un viaje en curso o viajes del día sin
 * hacer. Una jornada cerrada termina con el cierre de su último viaje.
 *
 * Es la misma regla que aplica el API en src/trips/jornada-extras.ts para el
 * panel financiero; si cambia acá, cambia allá.
 */
export const JORNADA_HORAS = 13;
export const JORNADA_MS = JORNADA_HORAS * 60 * 60 * 1000;
/** Umbral para avisar que la jornada está por vencer. */
export const JORNADA_AVISO_MS = 60 * 60 * 1000;

/** Estados en los que un viaje ya no le exige nada al conductor. */
const CERRADOS = new Set(["DROPPED_OFF", "COMPLETED", "CANCELLED"]);
const EN_MARCHA = new Set(["EN_ROUTE", "PICKED_UP"]);

export type EstadoJornada = "SIN_INICIAR" | "EN_JORNADA" | "POR_VENCER" | "EXTRA" | "CERRADA";

export type ViajeDeJornada = ViajeJornada & { driverId?: string | null };

export type Jornada = {
  driverId: string;
  inicio: Date | null;
  /** Inicio + 13 h. */
  limite: Date | null;
  /** Cierre real: fin del último viaje, o null si la jornada sigue abierta. */
  cierre: Date | null;
  estado: EstadoJornada;
  /** Milisegundos trabajados, hasta ahora o hasta el cierre. */
  trabajadoMs: number;
  /** Milisegundos por sobre las 13 h. */
  extraMs: number;
  /** Lo que mantiene la jornada abierta pasado el plazo. */
  viajeEnCurso: boolean;
  pendientes: number;
  totalViajes: number;
};

/** La jornada de un conductor a partir de sus viajes del día. */
export function jornadaDe(driverId: string, viajes: ViajeDeJornada[], ahora: Date = new Date()): Jornada {
  // Sólo viajes que están o estuvieron en marcha: uno devuelto a Programado
  // conserva un startedAt viejo que no arranca la jornada.
  const iniciados = iniciosDeJornada(viajes);
  if (iniciados.length === 0) {
    return {
      driverId, inicio: null, limite: null, cierre: null, estado: "SIN_INICIAR",
      trabajadoMs: 0, extraMs: 0, viajeEnCurso: false,
      pendientes: viajes.length, totalViajes: viajes.length,
    };
  }
  const inicio = iniciados[0];
  const limite = new Date(inicio.getTime() + JORNADA_MS);
  const viajeEnCurso = viajes.some((v) => EN_MARCHA.has(v.status ?? ""));
  // Programados del día que todavía no se hacen: mantienen el contador
  // corriendo pasado el plazo.
  const pendientes = viajes.filter((v) => !CERRADOS.has(v.status ?? "")).length;
  const cierres = viajes
    .map((v) => fecha(v.completedAt))
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime());
  const ultimoCierre = cierres[0] ?? null;

  const abierta = viajeEnCurso || pendientes > 0;
  const cierre = abierta ? null : ultimoCierre;
  const hasta = abierta ? ahora : (ultimoCierre ?? ahora);
  const trabajadoMs = Math.max(0, hasta.getTime() - inicio.getTime());
  const extraMs = Math.max(0, hasta.getTime() - limite.getTime());

  let estado: EstadoJornada;
  if (!abierta) estado = "CERRADA";
  else if (ahora >= limite) estado = "EXTRA";
  else if (limite.getTime() - ahora.getTime() <= JORNADA_AVISO_MS) estado = "POR_VENCER";
  else estado = "EN_JORNADA";

  return { driverId, inicio, limite, cierre, estado, trabajadoMs, extraMs, viajeEnCurso, pendientes, totalViajes: viajes.length };
}

/**
 * Jornadas de todos los conductores con viajes ese día. Primero quien está en
 * extras, después quien va a vencer: el orden en que el operador tiene que
 * actuar. `nombreDe` desempata por nombre.
 */
export function calcularJornadas(
  viajesDelDia: ViajeDeJornada[],
  ahora: Date = new Date(),
  nombreDe: (driverId: string) => string = () => "",
): Jornada[] {
  const porConductor = new Map<string, ViajeDeJornada[]>();
  for (const v of viajesDelDia) {
    if (!v.driverId) continue;
    const lista = porConductor.get(v.driverId) ?? [];
    lista.push(v);
    porConductor.set(v.driverId, lista);
  }
  const filas: Jornada[] = [];
  porConductor.forEach((viajes, driverId) => filas.push(jornadaDe(driverId, viajes, ahora)));
  const peso: Record<EstadoJornada, number> = { EXTRA: 0, POR_VENCER: 1, EN_JORNADA: 2, CERRADA: 3, SIN_INICIAR: 4 };
  return filas.sort(
    (a, b) =>
      peso[a.estado] - peso[b.estado] ||
      b.extraMs - a.extraMs ||
      nombreDe(a.driverId).localeCompare(nombreDe(b.driverId), "es"),
  );
}

/** "4 h 20 min", "35 min". Un contador de jornada no necesita segundos. */
export function formatoDuracion(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
