/**
 * Cuerpo de una consulta a SofIA (01-10-2026). Lleva el evento que el panel
 * tiene en pantalla: sin él, el servidor respondía con el evento "activo"
 * más reciente, que para las coordinadoras de World Rugby eran los Juegos
 * Escolares. En los portales no hay evento en pantalla y no se manda nada.
 */
export function cuerpoConsultaSofia(entrada: {
  question: string;
  previousResponseId?: string | null;
  locale?: string | null;
  eventoId?: string | null;
}): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = { question: entrada.question };
  if (entrada.previousResponseId) cuerpo.previousResponseId = entrada.previousResponseId;
  if (entrada.locale) cuerpo.locale = entrada.locale;
  if (entrada.eventoId) cuerpo.eventId = entrada.eventoId;
  return cuerpo;
}
