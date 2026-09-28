/**
 * Personas de un proveedor que NO trabajan en alguno de sus eventos
 * (28-09-2026). Al traer a ALEX AREVALO de los Juegos Escolares a World
 * Rugby venían sus 11 conductores, y para dejar sólo a dos Ariel los borró
 * con la papelera: salieron también de los Juegos Escolares, con 22 viajes
 * hechos. Ahora una persona puede quitarse de un evento sin borrarla:
 * trabaja en los eventos de su proveedor menos los de
 * metadata.eventosExcluidos.
 *
 * Misma regla que frontend/lib/proveedores-evento.ts (duplicada a propósito).
 */
export const CLAVE_EXCLUIDOS = 'eventosExcluidos';

const lista = (valor: unknown): string[] =>
  Array.isArray(valor)
    ? valor.filter((v): v is string => typeof v === 'string' && !!v)
    : [];

/** Eventos de los que se quitó a la persona. */
export function eventosExcluidos(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  return lista(metadata?.[CLAVE_EXCLUIDOS]);
}

/**
 * Eventos en que trabaja la persona: los de su proveedor menos los
 * excluidos. Vacío = proveedor sin eventos (vale para todos, como antes).
 */
export function eventosDePersona(
  eventosProveedor: string[] | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  const fuera = new Set(eventosExcluidos(metadata));
  return lista(eventosProveedor).filter((e) => !fuera.has(e));
}

/** ¿Se quitó a la persona de este evento? */
export function excluidaDelEvento(
  metadata: Record<string, unknown> | null | undefined,
  eventId: string | null | undefined,
): boolean {
  return !!eventId && eventosExcluidos(metadata).includes(eventId);
}

export type ResultadoQuitar =
  | { ok: true; metadata: Record<string, unknown> }
  | { ok: false; motivo: string };

/**
 * Metadata con el evento excluido. Sólo si el proveedor trabaja en el evento
 * y a la persona le queda otro: quitarla del último evento es eliminarla, y
 * una lista vacía se leería como "trabaja en todos".
 */
export function quitarPersonaDelEvento(
  eventosProveedor: string[] | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
  eventId: string,
): ResultadoQuitar {
  const actuales = eventosDePersona(eventosProveedor, metadata);
  if (!actuales.includes(eventId)) {
    return { ok: false, motivo: 'No está en este evento' };
  }
  if (actuales.length < 2) {
    return {
      ok: false,
      motivo: 'Sólo trabaja en este evento: para sacarla hay que eliminarla',
    };
  }
  return {
    ok: true,
    metadata: {
      ...(metadata ?? {}),
      [CLAVE_EXCLUIDOS]: [...eventosExcluidos(metadata), eventId],
    },
  };
}

/** Metadata con la persona de vuelta en el evento. null = no estaba quitada. */
export function devolverPersonaAlEvento(
  metadata: Record<string, unknown> | null | undefined,
  eventId: string,
): Record<string, unknown> | null {
  if (!excluidaDelEvento(metadata, eventId)) return null;
  const quedan = eventosExcluidos(metadata).filter((e) => e !== eventId);
  const nueva: Record<string, unknown> = { ...(metadata ?? {}) };
  if (quedan.length) nueva[CLAVE_EXCLUIDOS] = quedan;
  else delete nueva[CLAVE_EXCLUIDOS];
  return nueva;
}
