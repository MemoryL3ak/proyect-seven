/**
 * Evento activo del panel: un solo selector arriba que todas las secciones
 * respetan (27-09-2026). Antes cada pantalla tenía su propio selector y
 * varias abrían solas el evento más nuevo; con un segundo evento creado,
 * Viajes volvía al más nuevo cada 8 segundos aunque se eligiera el otro, y
 * las secciones sin selector (AND, Participantes, Hoteles, Sedes…) mezclaban
 * los dos eventos.
 *
 * Aquí va la parte sin React: qué evento abrir por defecto y cómo filtrar.
 */
import { claveDiaEvento } from "./hora-evento";

export type EventoResumen = {
  id: string;
  name?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  status?: string | null;
};

export type EtapaEvento = "EN_CURSO" | "PROXIMO" | "FINALIZADO" | "SIN_FECHAS";

export const ETAPA_EVENTO_LABEL: Record<EtapaEvento, string> = {
  EN_CURSO: "En curso",
  PROXIMO: "Próximo",
  FINALIZADO: "Finalizado",
  SIN_FECHAS: "Sin fechas",
};

/**
 * Las fechas del evento se guardan como medianoche UTC del día elegido en el
 * formulario ("2026-09-22" → 2026-09-22T00:00Z), así que el día es la parte
 * de la fecha en UTC, no la hora de Chile (que lo correría al día anterior).
 */
export function diaDeFechaEvento(valor?: string | Date | null): string | null {
  if (!valor) return null;
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Hoy en Chile, "YYYY-MM-DD". */
export const hoyEnChile = (ahora: Date = new Date()) => claveDiaEvento(ahora);

export function etapaEvento(evento: EventoResumen, hoy: string): EtapaEvento {
  const inicio = diaDeFechaEvento(evento.startDate) ?? diaDeFechaEvento(evento.endDate);
  const fin = diaDeFechaEvento(evento.endDate) ?? inicio;
  if (!inicio || !fin) return "SIN_FECHAS";
  if (hoy < inicio) return "PROXIMO";
  if (hoy > fin) return "FINALIZADO";
  return "EN_CURSO";
}

const esActivo = (e: EventoResumen) => String(e.status ?? "").toUpperCase() === "ACTIVE";
const inicioDe = (e: EventoResumen) => diaDeFechaEvento(e.startDate) ?? diaDeFechaEvento(e.endDate) ?? "";
const finDe = (e: EventoResumen) => diaDeFechaEvento(e.endDate) ?? diaDeFechaEvento(e.startDate) ?? "";

/**
 * Orden del selector: los que están en curso, luego los próximos (el más
 * cercano primero), los sin fechas y al final los terminados (el más
 * reciente primero). Dentro de "en curso" va primero el marcado como activo
 * y, entre iguales, el que empezó último: el 27-09 se creó World Rugby
 * (borrador, del 27-09 al 18-10) en plena operación de los Juegos Escolares
 * (activo) y el panel abría el de Rugby, vacío.
 */
export function ordenarEventos<T extends EventoResumen>(eventos: T[], hoy: string): T[] {
  const rango: Record<EtapaEvento, number> = { EN_CURSO: 0, PROXIMO: 1, SIN_FECHAS: 2, FINALIZADO: 3 };
  return [...eventos].sort((a, b) => {
    const ea = etapaEvento(a, hoy);
    const eb = etapaEvento(b, hoy);
    if (ea !== eb) return rango[ea] - rango[eb];
    if (ea === "EN_CURSO" && esActivo(a) !== esActivo(b)) return esActivo(a) ? -1 : 1;
    if (ea === "EN_CURSO" && inicioDe(a) !== inicioDe(b)) return inicioDe(b).localeCompare(inicioDe(a));
    if (ea === "PROXIMO" && inicioDe(a) !== inicioDe(b)) return inicioDe(a).localeCompare(inicioDe(b));
    if (ea === "FINALIZADO" && finDe(a) !== finDe(b)) return finDe(b).localeCompare(finDe(a));
    if (esActivo(a) !== esActivo(b)) return esActivo(a) ? -1 : 1;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""), "es");
  });
}

/** El evento que abre el panel si nadie eligió otro: el que está en curso. */
export function eventoPorDefecto(eventos: EventoResumen[], hoy: string): string {
  return ordenarEventos(eventos, hoy)[0]?.id ?? "";
}

/**
 * El evento elegido antes se respeta mientras exista; si lo borraron o nunca
 * se eligió, se abre el que está en curso.
 */
export function resolverEventoActivo(eventos: EventoResumen[], elegido: string | null | undefined, hoy: string): string {
  if (elegido && eventos.some((e) => e.id === elegido)) return elegido;
  return eventoPorDefecto(eventos, hoy);
}

/**
 * ¿La fila es del evento activo? Sin evento activo (cargando, o no hay
 * eventos) no se filtra nada. Una fila sin evento (documentos generales,
 * incidencias antiguas) se ve en todos.
 */
export function esDelEvento(eventoId: string | null | undefined, filaEventId: string | null | undefined): boolean {
  if (!eventoId) return true;
  if (!filaEventId) return true;
  return filaEventId === eventoId;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const diaCorto = (dia: string) => {
  const [, m, d] = dia.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ""}`;
};

/** "22 sep – 4 oct 2026", "22 sep 2026" o "" sin fechas. */
export function rangoEvento(evento: EventoResumen): string {
  const inicio = diaDeFechaEvento(evento.startDate);
  const fin = diaDeFechaEvento(evento.endDate);
  if (!inicio && !fin) return "";
  if (!inicio || !fin || inicio === fin) {
    const dia = (inicio ?? fin) as string;
    return `${diaCorto(dia)} ${dia.slice(0, 4)}`;
  }
  const mismoAnio = inicio.slice(0, 4) === fin.slice(0, 4);
  return `${diaCorto(inicio)}${mismoAnio ? "" : ` ${inicio.slice(0, 4)}`} – ${diaCorto(fin)} ${fin.slice(0, 4)}`;
}
