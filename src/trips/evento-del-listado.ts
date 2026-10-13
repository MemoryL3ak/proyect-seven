/**
 * Evento por el que se filtra GET /trips. 13-10-2026: la página de Viajes
 * bajaba los 1.946 viajes de todos los eventos (4,1 MB) cada 8 segundos y
 * después filtraba por el evento activo en el navegador; en un MacBook con
 * Safari la plataforma "cargaba pésimo". Ahora el panel pide `?eventId=`.
 *
 * El evento del portal (Comité, Jefe de Misión) siempre manda: la consulta
 * nunca amplía lo que alguien puede ver, sólo lo acota. Un valor que no es
 * uuid se ignora.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function eventoDelListado(eventoDelAlcance: string | null | undefined, consulta: string | null | undefined): string | null {
  if (eventoDelAlcance) return eventoDelAlcance;
  const q = (consulta ?? '').trim();
  return UUID.test(q) ? q : null;
}
