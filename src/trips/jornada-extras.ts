/**
 * Jornada de 13 h de cada conductor, para el panel financiero.
 *
 * Misma regla que el Control de jornada del panel de conductores
 * (frontend/lib/jornada.ts): arranca con el primer viaje iniciado del día; al
 * cumplirse el plazo no se corta, sigue como horas extra mientras quede un
 * viaje en curso o viajes del día sin hacer; una jornada cerrada termina con
 * el cierre de su último viaje. Si cambia acá, cambia allá.
 */
export const JORNADA_HORAS = 13;
const HORA_MS = 60 * 60 * 1000;

const SIN_INICIAR = new Set(['SCHEDULED', 'REQUESTED', 'CANCELLED']);
const CERRADOS = new Set(['DROPPED_OFF', 'COMPLETED', 'CANCELLED']);
const EN_MARCHA = new Set(['EN_ROUTE', 'PICKED_UP']);

export type ViajeJornadaRow = {
  driverId: string;
  /** Día operativo (YYYY-MM-DD, hora de Chile) al que pertenece el viaje. */
  dia: string;
  status: string | null;
  scheduledAt?: Date | string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  nombre?: string | null;
  providerId?: string | null;
  proveedor?: string | null;
};

export type JornadaCalculada = {
  driverId: string;
  nombre: string;
  providerId: string | null;
  proveedor: string;
  dia: string;
  inicio: string;
  /** Cierre del último viaje; null si la jornada sigue abierta. */
  fin: string | null;
  abierta: boolean;
  viajes: number;
  horasTrabajadas: number;
  horasExtra: number;
};

const fecha = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Inicio de un viaje en marcha o cerrado; sin `startedAt`, la marca más temprana. */
function inicioDeViaje(v: ViajeJornadaRow): Date | null {
  const directo = fecha(v.startedAt);
  if (directo) return directo;
  const candidatos = [
    fecha(v.completedAt),
    fecha(v.updatedAt),
    fecha(v.scheduledAt),
  ].filter((d): d is Date => !!d);
  return candidatos.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
}

const redondear = (ms: number) => Math.round((ms / HORA_MS) * 100) / 100;

/** Jornada de un conductor en un día; null si no inició ningún viaje. */
export function jornadaDelDia(
  viajes: ViajeJornadaRow[],
  ahora: Date,
  horas = JORNADA_HORAS,
): JornadaCalculada | null {
  const iniciados = viajes
    .filter((v) => !SIN_INICIAR.has(v.status ?? ''))
    .map(inicioDeViaje)
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime());
  if (iniciados.length === 0) return null;

  const inicio = iniciados[0];
  const limite = inicio.getTime() + horas * HORA_MS;
  const enCurso = viajes.some((v) => EN_MARCHA.has(v.status ?? ''));
  const pendientes = viajes.filter((v) => !CERRADOS.has(v.status ?? '')).length;
  const ultimoCierre =
    viajes
      .map((v) => fecha(v.completedAt))
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const abierta = enCurso || pendientes > 0;
  const hasta = abierta ? ahora : (ultimoCierre ?? ahora);
  const trabajadoMs = Math.max(0, hasta.getTime() - inicio.getTime());
  const extraMs = Math.max(0, hasta.getTime() - limite);
  const primero = viajes[0];

  return {
    driverId: primero.driverId,
    nombre: (primero.nombre ?? '').trim() || 'Conductor no registrado',
    providerId: primero.providerId ?? null,
    proveedor: (primero.proveedor ?? '').trim() || 'Sin proveedor',
    dia: primero.dia,
    inicio: inicio.toISOString(),
    fin: abierta ? null : (ultimoCierre?.toISOString() ?? null),
    abierta,
    viajes: viajes.length,
    horasTrabajadas: redondear(trabajadoMs),
    horasExtra: redondear(extraMs),
  };
}

/** Una jornada por conductor y día, ordenadas por día y horas extra. */
export function jornadasDeViajes(
  filas: ViajeJornadaRow[],
  ahora: Date = new Date(),
  horas = JORNADA_HORAS,
): JornadaCalculada[] {
  const grupos = new Map<string, ViajeJornadaRow[]>();
  for (const f of filas) {
    if (!f.driverId || !f.dia) continue;
    const clave = `${f.driverId}|${f.dia}`;
    const lista = grupos.get(clave) ?? [];
    lista.push(f);
    grupos.set(clave, lista);
  }
  const jornadas: JornadaCalculada[] = [];
  grupos.forEach((viajes) => {
    const j = jornadaDelDia(viajes, ahora, horas);
    if (j) jornadas.push(j);
  });
  return jornadas.sort(
    (a, b) =>
      b.dia.localeCompare(a.dia) ||
      b.horasExtra - a.horasExtra ||
      a.nombre.localeCompare(b.nombre, 'es'),
  );
}

export type ResumenJornadas = {
  horasJornada: number;
  generadoEn: string;
  totales: {
    conductores: number;
    jornadas: number;
    jornadasAbiertas: number;
    jornadasConExtra: number;
    horasTrabajadas: number;
    horasExtra: number;
  };
  porConductor: {
    driverId: string;
    nombre: string;
    proveedor: string;
    jornadas: number;
    jornadasConExtra: number;
    horasTrabajadas: number;
    horasExtra: number;
    /** Días con extras, del más reciente al más antiguo. */
    diasConExtra: string[];
  }[];
  jornadas: JornadaCalculada[];
};

export function resumenDeJornadas(
  jornadas: JornadaCalculada[],
  ahora: Date = new Date(),
): ResumenJornadas {
  const porConductor = new Map<
    string,
    ResumenJornadas['porConductor'][number]
  >();
  const tot = {
    conductores: 0,
    jornadas: 0,
    jornadasAbiertas: 0,
    jornadasConExtra: 0,
    horasTrabajadas: 0,
    horasExtra: 0,
  };
  for (const j of jornadas) {
    const c = porConductor.get(j.driverId) ?? {
      driverId: j.driverId,
      nombre: j.nombre,
      proveedor: j.proveedor,
      jornadas: 0,
      jornadasConExtra: 0,
      horasTrabajadas: 0,
      horasExtra: 0,
      diasConExtra: [],
    };
    c.jornadas += 1;
    c.horasTrabajadas += j.horasTrabajadas;
    c.horasExtra += j.horasExtra;
    if (j.horasExtra > 0) {
      c.jornadasConExtra += 1;
      c.diasConExtra.push(j.dia);
    }
    porConductor.set(j.driverId, c);
    tot.jornadas += 1;
    if (j.abierta) tot.jornadasAbiertas += 1;
    if (j.horasExtra > 0) tot.jornadasConExtra += 1;
    tot.horasTrabajadas += j.horasTrabajadas;
    tot.horasExtra += j.horasExtra;
  }
  const lista = [...porConductor.values()]
    .map((c) => ({
      ...c,
      horasTrabajadas: Math.round(c.horasTrabajadas * 100) / 100,
      horasExtra: Math.round(c.horasExtra * 100) / 100,
      diasConExtra: [...c.diasConExtra].sort((a, b) => b.localeCompare(a)),
    }))
    .sort(
      (a, b) =>
        b.horasExtra - a.horasExtra ||
        b.horasTrabajadas - a.horasTrabajadas ||
        a.nombre.localeCompare(b.nombre, 'es'),
    );
  tot.conductores = lista.length;
  tot.horasTrabajadas = Math.round(tot.horasTrabajadas * 100) / 100;
  tot.horasExtra = Math.round(tot.horasExtra * 100) / 100;
  return {
    horasJornada: JORNADA_HORAS,
    generadoEn: ahora.toISOString(),
    totales: tot,
    porConductor: lista,
    jornadas,
  };
}
