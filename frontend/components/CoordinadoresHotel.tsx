"use client";

import { PlusIcon, TrashIcon } from "@/components/ui/Icons";
import StyledSelect from "@/components/StyledSelect";
import { formatWhatsappPhone } from "@/lib/external-link";
import { useI18n } from "@/lib/i18n";

/**
 * Coordinadores y apoyos de un hotel.
 *
 * No es un par de campos como en las sedes —ahí hay un coordinador y ya—
 * porque la planilla de operaciones tiene hoteles con dos coordinadores
 * (Hippocampus, Mantagua, Marina Dunas), una misma persona a cargo de varios
 * hoteles, y gente de apoyo con turno anotado al lado del nombre:
 * "Francisco (all day)", "María José (pm)".
 *
 * El turno sólo se pide al apoyo, que es donde la planilla lo escribe; al
 * coordinador se le oculta para no sugerir un dato que nadie lleva.
 */

export const ROLES_CONTACTO_HOTEL = [
  { value: "COORDINADOR", label: "Coordinador" },
  { value: "APOYO", label: "Apoyo" }
] as const;

export const TURNOS_CONTACTO_HOTEL = [
  { value: "TODO_EL_DIA", label: "Todo el día" },
  { value: "AM", label: "Mañana" },
  { value: "PM", label: "Tarde" }
] as const;

export type ContactoHotel = {
  name: string;
  phone: string | null;
  role: "COORDINADOR" | "APOYO";
  shift: "TODO_EL_DIA" | "AM" | "PM" | null;
};

export function contactoHotelVacio(): ContactoHotel {
  return { name: "", phone: "", role: "COORDINADOR", shift: null };
}

/** Lo que se guarda: sin las filas que quedaron sin nombre. */
export function limpiarContactosHotel(lista: ContactoHotel[]): ContactoHotel[] {
  return lista
    .map((c) => ({
      ...c,
      name: c.name.trim(),
      phone: (c.phone ?? "").trim() || null,
      // Un coordinador no lleva turno: si alguien lo puso y después cambió el
      // rol, el dato quedaba guardado sin que el formulario lo mostrara.
      shift: c.role === "APOYO" ? c.shift : null
    }))
    .filter((c) => c.name.length > 0);
}

export function leerContactosHotel(value: unknown): ContactoHotel[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      name: String(item.name ?? ""),
      phone: item.phone ? String(item.phone) : "",
      role: String(item.role ?? "").toUpperCase() === "APOYO" ? "APOYO" : "COORDINADOR",
      shift: (["TODO_EL_DIA", "AM", "PM"] as const).find(
        (t) => t === String(item.shift ?? "").toUpperCase()
      ) ?? null
    }));
}

export default function CoordinadoresHotel({
  contactos,
  onChange
}: {
  contactos: ContactoHotel[];
  onChange: (lista: ContactoHotel[]) => void;
}) {
  const { t } = useI18n();

  const cambiar = (indice: number, cambios: Partial<ContactoHotel>) => {
    onChange(contactos.map((c, i) => (i === indice ? { ...c, ...cambios } : c)));
  };

  return (
    <div className="md:col-span-2 flex flex-col gap-3 pt-2">
      <div>
        <p className="section-label">{t("Coordinadores del hotel")}</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {t("Quién responde por el hotel y con qué teléfono. Se muestra en la ficha del hotel del portal.")}
        </p>
      </div>

      {contactos.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          {t("Sin coordinadores cargados.")}
        </p>
      )}

      {contactos.map((contacto, indice) => (
        <div
          key={indice}
          className="grid gap-3 md:grid-cols-[1.4fr_1.2fr_0.9fr_0.9fr_auto] items-end p-3 rounded-xl"
          style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}
        >
          <label className="flex flex-col gap-1.5 text-sm">
            {t("Nombre")}
            <input
              className="input"
              value={contacto.name}
              placeholder={t("Nombre y apellido")}
              onChange={(event) => cambiar(indice, { name: event.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            {t("Teléfono")}
            <input
              className="input"
              value={contacto.phone ?? ""}
              placeholder="+56 9 1234 5678"
              // Mismo formateo que el resto de los teléfonos del portal: lo que
              // se guarda es lo que WhatsApp necesita.
              onChange={(event) => cambiar(indice, { phone: formatWhatsappPhone(event.target.value) })}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            {t("Rol")}
            <StyledSelect
              value={contacto.role}
              onChange={(event) => {
                const role = event.target.value as ContactoHotel["role"];
                cambiar(indice, { role, shift: role === "APOYO" ? contacto.shift : null });
              }}
            >
              {ROLES_CONTACTO_HOTEL.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {t(opcion.label)}
                </option>
              ))}
            </StyledSelect>
          </label>

          {contacto.role === "APOYO" ? (
            <label className="flex flex-col gap-1.5 text-sm">
              {t("Turno")}
              <StyledSelect
                value={contacto.shift ?? ""}
                onChange={(event) =>
                  cambiar(indice, { shift: (event.target.value || null) as ContactoHotel["shift"] })
                }
              >
                <option value="">{t("Sin turno")}</option>
                {TURNOS_CONTACTO_HOTEL.map((opcion) => (
                  <option key={opcion.value} value={opcion.value}>
                    {t(opcion.label)}
                  </option>
                ))}
              </StyledSelect>
            </label>
          ) : (
            <span />
          )}

          <button
            type="button"
            className="btn btn-ghost"
            title={t("Quitar")}
            aria-label={t("Quitar")}
            onClick={() => onChange(contactos.filter((_, i) => i !== indice))}
          >
            <TrashIcon size={16} />
          </button>
        </div>
      ))}

      <div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onChange([...contactos, contactoHotelVacio()])}
        >
          <PlusIcon size={15} /> {t("Agregar coordinador")}
        </button>
      </div>
    </div>
  );
}
