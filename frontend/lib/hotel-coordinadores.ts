import type { CoordinadorLugar } from "@/components/portal/TarjetaLugar";

/** Tal como lo entrega GET /accommodations (columna jsonb `coordinators`). */
export type CoordinadorHotel = {
  name?: string | null;
  phone?: string | null;
  role?: string | null;
  shift?: string | null;
};

const TURNOS: Record<string, string> = {
  TODO_EL_DIA: "Todo el día",
  AM: "Mañana",
  PM: "Tarde"
};

/**
 * Los contactos de un hotel como los pinta TarjetaLugar.
 *
 * El rótulo dice el rol y, en el apoyo, el turno: es lo que la planilla de
 * operaciones anota entre paréntesis al lado del nombre —"Francisco (all
 * day)", "María José (pm)"— y lo que decide a quién llamar a cada hora.
 *
 * Los coordinadores van primero aunque en la ficha estén mezclados: quien
 * abre la tarjeta busca al que responde por el hotel, no al apoyo.
 */
export function contactosDeHotel(
  lista?: CoordinadorHotel[] | null,
  t: (texto: string) => string = (texto) => texto
): CoordinadorLugar[] {
  if (!Array.isArray(lista)) return [];
  const contactos = lista
    .filter((c) => c && (c.name || c.phone))
    .map((c) => {
      const esApoyo = String(c.role ?? "").toUpperCase() === "APOYO";
      const turno = TURNOS[String(c.shift ?? "").toUpperCase()];
      return {
        nombre: c.name ?? null,
        telefono: c.phone ?? null,
        rotulo: esApoyo
          ? [t("Apoyo"), turno ? t(turno) : ""].filter(Boolean).join(" · ")
          : t("Coordinador del hotel"),
        esApoyo
      };
    });
  return contactos
    .sort((a, b) => Number(a.esApoyo) - Number(b.esApoyo))
    .map(({ esApoyo: _esApoyo, ...contacto }) => contacto);
}
