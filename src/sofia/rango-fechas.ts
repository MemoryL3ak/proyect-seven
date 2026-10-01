import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

/**
 * Filtro de fecha para una herramienta de SofIA (01-10-2026).
 *
 * query_trips y query_flights asignaban `fromDate` y después `toDate` a la
 * misma clave del where: con las dos, la segunda pisaba a la primera y la
 * consulta "viajes de hoy" devolvía todo lo programado hasta el final del
 * día, cortado por el límite y ordenado por creación. A una coordinadora de
 * Rugby le salían 23 viajes de hoy donde había 26.
 */
export function rangoDeFechas(desde: unknown, hasta: unknown) {
  const d = fecha(desde);
  const h = fecha(hasta);
  if (d && h) return d <= h ? Between(d, h) : Between(h, d);
  if (d) return MoreThanOrEqual(d);
  if (h) return LessThanOrEqual(h);
  return null;
}

function fecha(valor: unknown): Date | null {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor !== 'string' || !valor.trim()) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const ZONA_EVENTO = 'America/Santiago';

type Partes = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: string };

function partesEn(zona: string, instante: Date): Partes {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
  }).formatToParts(instante);
  const n = (tipo: string) => Number(partes.find((x) => x.type === tipo)?.value ?? '0');
  return {
    year: n('year'),
    month: n('month'),
    day: n('day'),
    hour: n('hour') % 24,
    minute: n('minute'),
    second: n('second'),
    weekday: partes.find((x) => x.type === 'weekday')?.value ?? '',
  };
}

/** Desfase de la zona respecto de UTC en ese instante (ms). */
function desfaseMs(zona: string, instante: Date): number {
  const p = partesEn(zona, instante);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instante.getTime();
}

/** "miércoles 2026-10-01 23:30 (America/Santiago)": el modelo sabe qué día es hoy. */
export function ahoraEn(zona = ZONA_EVENTO, ahora = new Date()): string {
  const p = partesEn(zona, ahora);
  const dos = (v: number) => String(v).padStart(2, '0');
  const dia = new Intl.DateTimeFormat('es-CL', { timeZone: zona, weekday: 'long' }).format(ahora);
  return `${dia} ${p.year}-${dos(p.month)}-${dos(p.day)} ${dos(p.hour)}:${dos(p.minute)} (${zona})`;
}

/**
 * Inicio y fin del día de hoy en la zona del evento, en ISO (UTC). Sin esto
 * el modelo armaba "hoy" en UTC y perdía los viajes de la noche chilena.
 */
export function limitesDelDia(zona = ZONA_EVENTO, ahora = new Date()): { desde: string; hasta: string } {
  const p = partesEn(zona, ahora);
  const medianocheComoUtc = Date.UTC(p.year, p.month - 1, p.day);
  const desde = new Date(medianocheComoUtc - desfaseMs(zona, ahora));
  const hasta = new Date(desde.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}
