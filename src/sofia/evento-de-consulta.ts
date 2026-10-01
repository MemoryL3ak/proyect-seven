/**
 * A qué evento se refiere una consulta a SofIA (01-10-2026).
 *
 * El widget no mandaba el evento que el panel tiene en pantalla y el servidor
 * no miraba los eventos permitidos del usuario: cuando el modelo no ponía
 * eventId, cada herramienta caía al evento ACTIVO más reciente. Para las
 * coordinadoras de World Rugby (cuentas acotadas a ese evento, que está en
 * DRAFT mientras los Juegos Escolares siguen ACTIVE) SofIA respondía con los
 * datos de los Juegos: "no muestra la info correspondiente".
 */
export type EventoContexto = {
  /** Evento en pantalla (o el único permitido). null = sin preferencia. */
  actual: string | null;
  /** Eventos que el usuario puede ver. null o vacío = todos. */
  permitidos: string[] | null;
};

const limpio = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
};

const sinRestriccion = (permitidos: string[] | null | undefined) => !permitidos || permitidos.length === 0;

/**
 * Evento de la consulta: el que pide el cliente si lo puede ver; si no, el
 * primero de los permitidos. Sin restricción ni pedido, null (el servidor
 * usa entonces su evento activo).
 */
export function eventoDeConsulta(pedido: unknown, permitidos: string[] | null | undefined): string | null {
  const p = limpio(pedido);
  if (sinRestriccion(permitidos)) return p;
  const lista = permitidos as string[];
  return p && lista.includes(p) ? p : lista[0];
}

/**
 * Evento que recibe una herramienta: lo que puso el modelo, si el usuario
 * puede verlo (un administrador puede preguntar por otro evento); si no, el
 * de la consulta. Un eventId vacío ("") cuenta como ausente: antes llegaba a
 * la base y fallaba con "invalid input syntax for type uuid".
 */
export function eventoParaHerramienta(argEventId: unknown, contexto: EventoContexto | null | undefined): string | null {
  const pedido = limpio(argEventId);
  if (!contexto) return pedido;
  if (pedido && (sinRestriccion(contexto.permitidos) || contexto.permitidos!.includes(pedido))) return pedido;
  return contexto.actual ?? pedido;
}
