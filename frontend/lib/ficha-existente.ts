/**
 * ¿La fila de la planilla es alguien que ya tiene ficha en el evento?
 * (29-09-2026)
 *
 * Se buscaba sólo por pasaporte o correo. La planilla de Rugby trae árbitros
 * y "Delegación Portugal" sin ninguno de los dos, así que volver a subirla
 * creó una segunda ficha para cada uno (7 duplicadas). Ahora, sin pasaporte
 * ni correo que calce, se busca por nombre dentro del mismo evento.
 */

export type FichaBuscable = {
  id?: string;
  eventId?: string | null;
  fullName?: string | null;
  email?: string | null;
  passportNumber?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

/** "  José  PÉREZ " → "jose perez". */
export function claveNombre(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const minus = (v: unknown) => String(v ?? "").trim().toLowerCase();
const k = (eventId: unknown, clave: string) => `${String(eventId ?? "")}::${clave}`;
const reciente = (f: FichaBuscable) => String(f.updatedAt ?? f.createdAt ?? "");

export function buscadorDeFichas<T extends FichaBuscable>(fichas: T[]) {
  const porPasaporte = new Map<string, T>();
  const porCorreo = new Map<string, T>();
  const porNombre = new Map<string, T>();

  const registrar = (f: T) => {
    if (minus(f.passportNumber)) porPasaporte.set(k(f.eventId, minus(f.passportNumber)), f);
    if (minus(f.email)) porCorreo.set(k(f.eventId, minus(f.email)), f);
    const nombre = claveNombre(f.fullName);
    if (nombre) {
      // Si ya hay dos con el mismo nombre, se queda con la más reciente: la
      // que tocó la última carga, que es la que tiene los traslados vivos.
      const previa = porNombre.get(k(f.eventId, nombre));
      if (!previa || reciente(f) >= reciente(previa)) porNombre.set(k(f.eventId, nombre), f);
    }
  };
  fichas.forEach(registrar);

  const buscar = (q: { eventId: string; pasaporte?: unknown; correo?: unknown; nombre?: unknown }): T | undefined => {
    const pasaporte = minus(q.pasaporte);
    if (pasaporte && porPasaporte.has(k(q.eventId, pasaporte))) return porPasaporte.get(k(q.eventId, pasaporte));
    const correo = minus(q.correo);
    if (correo && porCorreo.has(k(q.eventId, correo))) return porCorreo.get(k(q.eventId, correo));
    const nombre = claveNombre(q.nombre);
    const mismoNombre = nombre ? porNombre.get(k(q.eventId, nombre)) : undefined;
    if (!mismoNombre) return undefined;
    // Se llama igual pero su ficha tiene otro pasaporte u otro correo: es otra
    // persona. Si la ficha no los tenía, es la misma y la planilla los agrega.
    if (pasaporte && minus(mismoNombre.passportNumber) && minus(mismoNombre.passportNumber) !== pasaporte) return undefined;
    if (correo && minus(mismoNombre.email) && minus(mismoNombre.email) !== correo) return undefined;
    return mismoNombre;
  };

  return { buscar, registrar };
}
