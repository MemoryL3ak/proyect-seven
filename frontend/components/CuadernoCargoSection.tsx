"use client";

import { useMemo, useState } from "react";
import {
  CUADERNO_CATEGORIES,
  CUADERNO_ENTRIES,
  CUADERNO_INFO,
  type CuadernoCategoryKey,
} from "@/lib/cuadernoCargo";
import { BookOpenIcon } from "@/components/ui/Icons";
import { BRAND, SURFACE } from "@/lib/design";

/**
 * Cuaderno de Cargo para la sección "Cuenta" de los portales.
 * Versión compacta y plegable del material de referencia del Centro de Ayuda:
 * filtro por categoría, búsqueda y lista de entradas.
 */
export default function CuadernoCargoSection() {
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState<CuadernoCategoryKey | "all">("all");
  const [busqueda, setBusqueda] = useState("");

  const entradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return CUADERNO_ENTRIES.filter((e) => {
      if (categoria !== "all" && e.category !== categoria) return false;
      if (!q) return true;
      return (
        e.term.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        (e.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [categoria, busqueda]);

  const colorDe = (key: CuadernoCategoryKey) =>
    CUADERNO_CATEGORIES.find((c) => c.key === key)?.color || SURFACE.textMuted;

  return (
    <div
      style={{
        background: SURFACE.card,
        border: `1px solid ${SURFACE.border}`,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden style={{ display: "inline-flex" }}><BookOpenIcon size={18} /></span>
          <span>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: SURFACE.text }}>
              Cuaderno de Cargo
            </span>
            <span style={{ display: "block", fontSize: 11.5, color: SURFACE.textMuted }}>
              Referencia operativa de transporte: glosario, roles, recintos y coordinadores
            </span>
          </span>
        </span>
        <span aria-hidden style={{ color: SURFACE.textFaint, transform: open ? "rotate(90deg)" : "none", transition: "transform 150ms ease" }}>
          ›
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${SURFACE.borderMuted}` }}>
          <p style={{ fontSize: 11.5, color: SURFACE.textMuted, margin: "12px 0" }}>{CUADERNO_INFO.desc.es}</p>

          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en el cuaderno…"
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 10,
              border: `1px solid ${SURFACE.border}`,
              fontSize: 13,
              marginBottom: 10,
            }}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setCategoria("all")}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid",
                borderColor: categoria === "all" ? BRAND.teal : SURFACE.border,
                background: categoria === "all" ? "rgba(33,208,179,0.1)" : SURFACE.card,
                color: categoria === "all" ? BRAND.tealInk : SURFACE.textMuted,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Todo
            </button>
            {CUADERNO_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategoria(c.key)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: categoria === c.key ? c.color : SURFACE.border,
                  background: categoria === c.key ? `${c.color}18` : SURFACE.card,
                  color: categoria === c.key ? c.color : SURFACE.textMuted,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {c.label.es}
              </button>
            ))}
          </div>

          <div style={{ maxHeight: 320, overflowY: "auto", display: "grid", gap: 8 }}>
            {entradas.length === 0 ? (
              <p style={{ fontSize: 12.5, color: SURFACE.textFaint, textAlign: "center", padding: "16px 0" }}>
                Sin resultados para la búsqueda.
              </p>
            ) : (
              entradas.map((e, i) => (
                <div
                  key={`${e.category}-${e.term}-${i}`}
                  style={{
                    border: `1px solid ${SURFACE.borderMuted}`,
                    borderLeft: `3px solid ${colorDe(e.category)}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#fbfdff",
                  }}
                >
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{e.term}</p>
                  <p style={{ fontSize: 12, color: SURFACE.textSecondary, margin: "4px 0 0", lineHeight: 1.5 }}>{e.detail}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
