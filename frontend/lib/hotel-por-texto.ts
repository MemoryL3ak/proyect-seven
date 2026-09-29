/**
 * Hotel de una planilla de carga (AND / participantes) contra los hoteles del
 * evento (29-09-2026).
 *
 * La carga buscaba el nombre exacto: "Sheraton" o "Torre Mayor" no calzaban
 * con "Hotel Sheraton Santiago" ni "Hotel Torremayor", el hotel se descartaba
 * sin avisar y cada traslado quedaba con destino "Hotel por confirmar". En
 * Rugby, 29 de 30 fichas quedaron sin hotel.
 */

export type HotelBuscable = { id: string; name?: string | null; eventId?: string | null };

/** "Hotel Torre-Mayor" → "torremayor": sin tildes, sin la palabra hotel, sin espacios. */
export function claveHotel(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bhotel(es)?\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * null si la celda viene vacía; { hotel } si hay uno solo que calce; { error }
 * si no hay ninguno o hay más de uno.
 */
export function hotelDeTexto<T extends HotelBuscable>(
  texto: unknown,
  hoteles: T[],
  eventId: string | null | undefined,
): { hotel: T } | { error: string } | null {
  const crudo = String(texto ?? "").trim();
  if (!crudo) return null;
  const clave = claveHotel(crudo);
  const delEvento = hoteles.filter((h) => !eventId || h.eventId === eventId);
  const nombres = delEvento.map((h) => h.name).filter(Boolean).join(", ") || "ninguno";
  if (!clave) return { error: `Hotel "${crudo}" no reconocido. Hoteles del evento: ${nombres}.` };

  const exactos = delEvento.filter((h) => claveHotel(h.name) === clave);
  if (exactos.length === 1) return { hotel: exactos[0] };

  // "Sheraton" dentro de "Sheraton Santiago", o al revés. Con 4 letras o más,
  // para que "sa" no calce con todo.
  const parecidos = delEvento.filter((h) => {
    const otra = claveHotel(h.name);
    if (!otra) return false;
    return (clave.length >= 4 && otra.includes(clave)) || (otra.length >= 4 && clave.includes(otra));
  });
  if (parecidos.length === 1) return { hotel: parecidos[0] };
  if (parecidos.length > 1) {
    return { error: `Hotel "${crudo}" calza con varios: ${parecidos.map((h) => h.name).join(", ")}. Escribe el nombre completo.` };
  }
  return { error: `Hotel "${crudo}" no existe en este evento. Hoteles del evento: ${nombres}.` };
}
