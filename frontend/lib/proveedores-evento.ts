/**
 * Proveedores por evento (28-09-2026). Cada proveedor guarda en eventIds los
 * eventos en que trabaja; sus participantes y conductores cuelgan del
 * proveedor, así que un mismo proveedor (BVAN en los Juegos Escolares y en
 * World Rugby) está en varios eventos sin duplicar a nadie. Antes Proveedores
 * era una sola lista y, trabajando en World Rugby, Ariel veía los proveedores
 * de los Juegos Escolares.
 *
 * Aquí va la parte sin React: quién se ve en el evento activo, quién se puede
 * traer de otro evento y cómo quedan los eventIds al agregar o quitar.
 */

export type ProveedorConEventos = {
  id: string;
  name?: string | null;
  parentProviderId?: string | null;
  eventIds?: string[] | null;
};

const eventosDe = (eventIds?: string[] | null): string[] => (Array.isArray(eventIds) ? eventIds : []);

/**
 * ¿El proveedor trabaja en el evento? Sin evento activo (cargando, o no hay
 * eventos) no se filtra. Un proveedor sin eventos es anterior a esta regla o
 * lo creó otra pantalla: se ve en todos para no perderlo de vista.
 */
export function proveedorEnEvento(eventIds: string[] | null | undefined, eventoId: string | null | undefined): boolean {
  if (!eventoId) return true;
  const eventos = eventosDe(eventIds);
  if (eventos.length === 0) return true;
  return eventos.includes(eventoId);
}

/** Los proveedores del evento activo, en el mismo orden. */
export function proveedoresDelEvento<T extends ProveedorConEventos>(proveedores: T[], eventoId: string | null | undefined): T[] {
  return proveedores.filter((p) => proveedorEnEvento(p.eventIds, eventoId));
}

/**
 * Participantes (y conductores) del evento: los de un proveedor que trabaja
 * en él. Uno cuyo proveedor no está en la lista (no se sabe de qué evento
 * es) se muestra, igual que un proveedor sin eventos.
 */
export function participantesDelEvento<P extends { providerId?: string | null }>(
  participantes: P[],
  proveedores: ProveedorConEventos[],
  eventoId: string | null | undefined,
): P[] {
  if (!eventoId) return participantes;
  const porId = new Map(proveedores.map((p) => [p.id, p]));
  return participantes.filter((pa) => {
    const prov = pa.providerId ? porId.get(pa.providerId) : undefined;
    return !prov || proveedorEnEvento(prov.eventIds, eventoId);
  });
}

export type ProveedorParaTraer<T> = { proveedor: T; subproveedores: T[] };

/**
 * Lo que se puede traer al evento activo: los proveedores que están en otro
 * evento y no en éste. Un principal viene con sus subproveedores; un
 * subproveedor se ofrece solo cuando su padre ya está aquí (o ya no existe),
 * porque si no llega junto con el padre. Los sin eventos ya se ven en todos
 * y no se ofrecen.
 */
export function proveedoresParaTraer<T extends ProveedorConEventos>(
  proveedores: T[],
  eventoId: string | null | undefined,
): ProveedorParaTraer<T>[] {
  if (!eventoId) return [];
  const porId = new Map(proveedores.map((p) => [p.id, p]));
  const fueraDelEvento = (p: T) => eventosDe(p.eventIds).length > 0 && !eventosDe(p.eventIds).includes(eventoId);
  const seOfreceSolo = (p: T) => {
    const padre = p.parentProviderId ? porId.get(p.parentProviderId) : undefined;
    return !padre || !fueraDelEvento(padre);
  };
  return proveedores
    .filter((p) => fueraDelEvento(p) && seOfreceSolo(p))
    .map((p) => ({ proveedor: p, subproveedores: proveedores.filter((s) => s.parentProviderId === p.id) }))
    .sort((a, b) => String(a.proveedor.name ?? "").localeCompare(String(b.proveedor.name ?? ""), "es"));
}

/**
 * eventIds con el evento agregado, sin repetir. null = no hay nada que
 * guardar: ya está, o no tiene eventos (se ve en todos y dejaría de verse en
 * los demás si se le pusiera sólo éste).
 */
export function agregarEvento(eventIds: string[] | null | undefined, eventoId: string | null | undefined): string[] | null {
  if (!eventoId) return null;
  const eventos = eventosDe(eventIds);
  if (eventos.length === 0 || eventos.includes(eventoId)) return null;
  return Array.from(new Set([...eventos, eventoId]));
}

/**
 * eventIds sin el evento. Si no le queda ninguno (o no tenía), pasa a los
 * eventos de `respaldo` (los que le quedan a su proveedor padre): un
 * subproveedor sin eventos se vería en todos, también en el que se quitó.
 * null = no hay nada que guardar.
 */
export function quitarEvento(
  eventIds: string[] | null | undefined,
  eventoId: string | null | undefined,
  respaldo: string[] = [],
): string[] | null {
  if (!eventoId) return null;
  const eventos = eventosDe(eventIds);
  if (eventos.length > 0 && !eventos.includes(eventoId)) return null;
  const quedan = eventos.filter((e) => e !== eventoId);
  if (quedan.length > 0) return quedan;
  const otros = respaldo.filter((e) => e !== eventoId);
  return otros.length > 0 ? Array.from(new Set(otros)) : null;
}

/**
 * Qué hace la papelera en la tarjeta: si el proveedor trabaja además en otro
 * evento sólo sale de éste (sus conductores siguen en el otro); si es sólo de
 * éste (o no tiene eventos) se elimina como siempre.
 */
export function accionAlQuitar(
  eventIds: string[] | null | undefined,
  eventoId: string | null | undefined,
): "QUITAR_DEL_EVENTO" | "ELIMINAR" {
  const eventos = eventosDe(eventIds);
  if (eventoId && eventos.includes(eventoId) && eventos.length > 1) return "QUITAR_DEL_EVENTO";
  return "ELIMINAR";
}

/** Los otros eventos del proveedor, además del activo. */
export function otrosEventos(eventIds: string[] | null | undefined, eventoId: string | null | undefined): string[] {
  return eventosDe(eventIds).filter((e) => e !== eventoId);
}

/**
 * Eventos de un proveedor nuevo: los de su padre si es subproveedor (más el
 * activo), si no el activo. Vacío = no mandar nada (sin evento activo).
 */
export function eventosParaNuevo(
  eventoId: string | null | undefined,
  padre?: ProveedorConEventos | null,
): string[] {
  const delPadre = eventosDe(padre?.eventIds);
  if (delPadre.length > 0) return eventoId ? Array.from(new Set([...delPadre, eventoId])) : [...delPadre];
  return eventoId ? [eventoId] : [];
}

/** Nombres de los eventos, en el orden de ids; los que ya no existen se omiten. */
export function nombresDeEventos(
  ids: string[],
  eventos: Array<{ id: string; name?: string | null }>,
): string[] {
  const porId = new Map(eventos.map((e) => [e.id, e.name]));
  return ids.map((id) => porId.get(id)).filter((n): n is string => !!n && !!n.trim());
}

/** Recorta un nombre largo para la nota de la tarjeta ("World Rugby U20…"). */
export function recortar(nombre: string, max = 28): string {
  const limpio = nombre.trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1).trimEnd()}…` : limpio;
}
