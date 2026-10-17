"use client";

import { useEffect, useRef } from "react";
import { ACCENT, BRAND, SURFACE } from "@/lib/design";
import { UsersIcon } from "@/components/ui/Icons";
import { useIsMobile } from "@/lib/useIsMobile";
import { useI18n } from "@/lib/i18n";

export type PasajeroListado = { nombre: string; delegacion?: string | null };

type Props = {
  open: boolean;
  /** "Vuelo LA715 · Aeropuerto → Hotel Almasur Providencia". */
  subtitulo?: string | null;
  pasajeros: PasajeroListado[];
  onClose: () => void;
};

/**
 * Todos los pasajeros de un traslado (17-10-2026). La fila del Monitoreo de
 * Llegadas muestra hasta cinco nombres; el resto se ve acá, con el mismo
 * aspecto que el diálogo de confirmación del panel.
 */
export default function PasajerosDialog({ open, subtitulo, pasajeros, onClose }: Props) {
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    cerrarRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pd-title"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center",
        padding: isMobile ? 0 : "16px",
        background: "rgba(2,12,24,0.72)",
        backdropFilter: "blur(6px)",
        animation: "cd-bg-in .18s ease both",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes cd-bg-in{from{opacity:0}to{opacity:1}}
        @keyframes cd-in{from{opacity:0;transform:scale(0.92) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
      `}</style>
      <div
        style={{
          background: SURFACE.card,
          borderRadius: isMobile ? "20px 20px 0 0" : "20px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.28), 0 0 0 1px rgba(226,232,240,0.8)",
          padding: isMobile ? "24px 20px calc(20px + env(safe-area-inset-bottom))" : "28px 28px 22px",
          maxWidth: isMobile ? "none" : "440px",
          width: "100%",
          maxHeight: isMobile ? "80dvh" : "min(640px, calc(100dvh - 32px))",
          display: "flex", flexDirection: "column",
          animation: "cd-in .22s cubic-bezier(0.16,1,0.3,1) both",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,${BRAND.teal},${BRAND.tealLight},${BRAND.teal})` }} />

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "14px", flexShrink: 0,
            background: "rgba(33,208,179,0.1)", border: "1px solid rgba(33,208,179,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <UsersIcon size={20} color={BRAND.teal} strokeWidth={2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 id="pd-title" style={{ fontSize: "16px", fontWeight: 700, color: SURFACE.text, margin: 0, letterSpacing: "-0.01em" }}>
              {pasajeros.length} {pasajeros.length === 1 ? t("pasajero") : t("pasajeros")}
            </h2>
            {subtitulo && (
              <p style={{ fontSize: "12px", color: SURFACE.textMuted, margin: "2px 0 0", lineHeight: 1.4 }}>{subtitulo}</p>
            )}
          </div>
        </div>

        <ol style={{ listStyle: "none", margin: 0, padding: 0, overflowY: "auto", flex: 1, borderTop: `1px solid ${SURFACE.borderMuted}` }}>
          {pasajeros.map((p, i) => (
            <li
              key={`${p.nombre}-${i}`}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "9px 2px", borderBottom: `1px solid ${SURFACE.borderMuted}`,
                fontSize: "13.5px", color: SURFACE.text,
              }}
            >
              <span style={{ width: "22px", flexShrink: 0, fontSize: "11px", fontWeight: 700, color: SURFACE.textMuted, textAlign: "right" }}>{i + 1}</span>
              <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</span>
              {p.delegacion && (
                <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(99,102,241,0.08)", color: ACCENT.indigo, border: "1px solid rgba(99,102,241,0.15)" }}>{p.delegacion}</span>
              )}
            </li>
          ))}
        </ol>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 22px", borderRadius: "12px", border: "none", minHeight: isMobile ? "48px" : undefined,
              width: isMobile ? "100%" : undefined,
              background: `linear-gradient(135deg,${BRAND.teal},#17a68e)`,
              color: SURFACE.card, fontSize: "14px", fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(33,208,179,0.35)",
            }}
          >
            {t("Cerrar")}
          </button>
        </div>
      </div>
    </div>
  );
}
