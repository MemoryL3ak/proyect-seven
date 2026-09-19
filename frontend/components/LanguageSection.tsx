"use client";

import { useI18n } from "@/lib/i18n";
import { BRAND, SURFACE } from "@/lib/design";

/**
 * Selector de idioma para la sección "Cuenta" de los portales.
 *
 * Antes el idioma lo imponía el teléfono. Como la aplicación está escrita en
 * español y los diccionarios no cubren cada frase, un teléfono en inglés
 * mostraba las dos lenguas mezcladas en la misma pantalla ("ORIGIN" sobre una
 * dirección, "MY DELEGATION'S TRIPS" junto a "Programado"). Ahora se entra en
 * español y quien quiera otro idioma lo elige aquí.
 */
const IDIOMAS = [
  { clave: "es", nombre: "Español" },
  { clave: "en", nombre: "English" },
  { clave: "pt", nombre: "Português" },
] as const;

export default function LanguageSection() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      style={{
        background: SURFACE.card,
        border: `1px solid ${SURFACE.border}`,
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: SURFACE.textFaint,
          margin: "0 0 8px",
        }}
      >
        {t("IDIOMA")}
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        {IDIOMAS.map((idioma) => {
          const activo = locale === idioma.clave;
          return (
            <button
              key={idioma.clave}
              type="button"
              onClick={() => setLocale(idioma.clave)}
              aria-pressed={activo}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "9px 6px",
                borderRadius: 10,
                border: `1px solid ${activo ? BRAND.teal : SURFACE.border}`,
                background: activo ? "rgba(33,208,179,0.10)" : SURFACE.card,
                color: activo ? BRAND.tealInk : SURFACE.textSecondary,
                fontSize: 12.5,
                fontWeight: activo ? 800 : 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {idioma.nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
