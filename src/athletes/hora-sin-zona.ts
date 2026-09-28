/**
 * Hora de llegada o salida que llega sin zona ("2026-09-28T14:15", de un campo
 * datetime-local). 28-09-2026: el formulario de AND la mandaba así y la base
 * la tomaba como UTC, corriéndola 3 h. El formulario ya manda la zona; esto
 * cubre las versiones de la web que sigan abiertas y cualquier otra pantalla
 * que mande la hora a secas: sin zona, es hora de Chile.
 */
const ZONA = 'America/Santiago';
const SIN_ZONA = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

export function horaChileAIso(
  valor: string | null | undefined,
): string | null | undefined {
  if (valor === null || valor === undefined) return valor;
  const m = String(valor).trim().match(SIN_ZONA);
  if (!m) return valor;
  const [, a, mes, d, h, min, s] = m.map(Number);
  // Desfase real de Chile en esa fecha (cambia con el horario de verano).
  const tentativo = Date.UTC(a, mes - 1, d, h, min, s || 0);
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ZONA,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(tentativo))
      .map((p) => [p.type, p.value]),
  );
  const comoLocal = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second),
  );
  return new Date(tentativo - (comoLocal - tentativo)).toISOString();
}
