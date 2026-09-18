"use client";

import { BRAND, SURFACE } from "@/lib/design";

/**
 * Controles de filtro de los portales (lo que se usa dentro de la app).
 *
 * Los <select> nativos del teléfono se ven ajenos: doble flecha de iOS, caja
 * alta y tipografía del sistema. Estos dos controles son los mismos que ya
 * usaba la barra de estados del Portal Conductor, ahora compartidos:
 *  - SegmentedFilter: 2 a 4 opciones que caben en una línea.
 *  - ChipFilter: muchas opciones, en fichas que se desplazan de lado.
 */
export type FilterOption = { value: string; label: string; count?: number };

const CLASE_SCROLL = "seven-filter-scroll";

/** Oculta la barra de desplazamiento de las fichas (una sola vez por pantalla). */
function EstiloScroll() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
        .${CLASE_SCROLL}{scrollbar-width:none;-ms-overflow-style:none}
        .${CLASE_SCROLL}::-webkit-scrollbar{display:none}
      `,
      }}
    />
  );
}

export function SegmentedFilter({
  value,
  options,
  onChange,
  style,
}: {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        padding: 3,
        borderRadius: 10,
        background: SURFACE.bg,
        border: `1px solid ${SURFACE.borderMuted}`,
        ...style,
      }}
    >
      {options.map((option) => {
        const activo = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            style={{
              flex: 1,
              padding: "7px 4px",
              fontSize: 12,
              fontWeight: 700,
              textAlign: "center",
              cursor: "pointer",
              border: "none",
              borderRadius: 8,
              background: activo ? SURFACE.card : "transparent",
              color: activo ? BRAND.tealInk : SURFACE.textSecondary,
              boxShadow: activo ? "0 1px 3px rgba(15,23,42,0.12)" : "none",
              transition: "background 120ms ease, color 120ms ease",
            }}
          >
            {option.label}
            {option.count !== undefined ? ` · ${option.count}` : ""}
          </button>
        );
      })}
    </div>
  );
}

export function ChipFilter({
  value,
  options,
  onChange,
  allLabel,
  style,
}: {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** Ficha inicial que quita el filtro; si no se pasa, no se muestra. */
  allLabel?: string;
  style?: React.CSSProperties;
}) {
  const fichas: FilterOption[] = allLabel ? [{ value: "", label: allLabel }, ...options] : options;
  return (
    <>
      <EstiloScroll />
      <div
        className={CLASE_SCROLL}
        style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, ...style }}
      >
        {fichas.map((option) => {
          const activo = option.value === value;
          return (
            <button
              key={option.value || "__todas"}
              type="button"
              onClick={() => onChange(option.value)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
                cursor: "pointer",
                border: `1px solid ${activo ? BRAND.teal : SURFACE.border}`,
                background: activo ? BRAND.teal : SURFACE.bg,
                color: activo ? "#fff" : SURFACE.textStrong,
                transition: "background 120ms ease, border-color 120ms ease",
              }}
            >
              {option.label}
              {option.count !== undefined ? ` · ${option.count}` : ""}
            </button>
          );
        })}
      </div>
    </>
  );
}
