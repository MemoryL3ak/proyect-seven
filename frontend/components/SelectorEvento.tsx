"use client";

/**
 * Selector del evento activo, en la barra superior del panel. Cambia el
 * evento de todas las secciones a la vez y se recuerda en este navegador.
 * Si el evento elegido no es el que está en curso, la etiqueta lo dice
 * ("Finalizado", "Próximo") para que nadie opere el evento equivocado.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { CalendarIcon, CheckIcon, ChevronDownIcon } from "@/components/ui/Icons";
import { useI18n } from "@/lib/i18n";
import { useEventoActivo } from "@/lib/evento-activo-provider";
import { ETAPA_EVENTO_LABEL, etapaEvento, hoyEnChile, rangoEvento, type EtapaEvento } from "@/lib/evento-activo";

const COLOR_ETAPA: Record<EtapaEvento, { fg: string; bg: string }> = {
  EN_CURSO: { fg: STATE.successText, bg: STATE.successSoft },
  PROXIMO: { fg: STATE.infoText, bg: STATE.infoSoft },
  FINALIZADO: { fg: SURFACE.textMuted, bg: SURFACE.borderMuted },
  SIN_FECHAS: { fg: SURFACE.textMuted, bg: SURFACE.borderMuted },
};

function Etapa({ etapa }: { etapa: EtapaEvento }) {
  const { t } = useI18n();
  const c = COLOR_ETAPA[etapa];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
      color: c.fg, background: c.bg, borderRadius: 999, padding: "2px 8px",
    }}>
      {etapa === "EN_CURSO" && <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: STATE.success }} />}
      {t(ETAPA_EVENTO_LABEL[etapa])}
    </span>
  );
}

export default function SelectorEvento() {
  const { t } = useI18n();
  const { eventos, evento, eventoId, setEventoId } = useEventoActivo();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hoy = hoyEnChile();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("touchstart", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  if (eventos.length === 0) return null;

  const etapa = evento ? etapaEvento(evento, hoy) : null;
  const unSoloEvento = eventos.length === 1;

  return (
    // Con un solo evento no hay nada que elegir: en el teléfono se oculta
    // para dejarle la línea al título.
    <div ref={ref} className={`topbar-evento${unSoloEvento ? " topbar-evento-unico" : ""}`} style={{ position: "relative", minWidth: 0 }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={t("Evento activo")}
        title={evento?.name ?? t("Evento activo")}
        style={{
          display: "flex", alignItems: "center", gap: 10, height: 44, maxWidth: 360, minWidth: 0,
          padding: "0 12px", borderRadius: 12, cursor: "pointer", textAlign: "left",
          background: SURFACE.card,
          border: `1px solid ${abierto ? BRAND.teal : SURFACE.border}`,
          boxShadow: abierto ? `0 0 0 3px ${BRAND.teal}22` : "none",
          color: SURFACE.text, transition: "border-color 150ms ease, box-shadow 150ms ease",
        }}
      >
        <span aria-hidden style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center",
          background: "rgba(33,208,179,0.12)", color: BRAND.teal,
        }}>
          <CalendarIcon size={15} />
        </span>
        <span className="topbar-evento-texto" style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SURFACE.textMuted }}>
              {t("Evento")}
            </span>
            {etapa && etapa !== "EN_CURSO" && <Etapa etapa={etapa} />}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {evento?.name ?? t("Elegir evento")}
          </span>
        </span>
        <span aria-hidden style={{ color: SURFACE.textMuted, flexShrink: 0, display: "inline-flex", transform: abierto ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}>
          <ChevronDownIcon size={14} />
        </span>
      </button>

      {abierto && (
        <div
          role="listbox"
          aria-label={t("Evento activo")}
          className="topbar-evento-menu"
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 60,
            width: 380, maxWidth: "calc(100vw - 32px)", maxHeight: 420, overflowY: "auto",
            background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 14,
            boxShadow: "0 18px 48px rgba(15,23,42,0.18)", padding: 6,
          }}
        >
          <p style={{ margin: 0, padding: "8px 10px 6px", fontSize: 11, color: SURFACE.textMuted, lineHeight: 1.4 }}>
            {t("Todas las secciones del panel muestran el evento que elijas.")}
          </p>
          {eventos.map((e) => {
            const elegido = e.id === eventoId;
            const rango = rangoEvento(e);
            return (
              <button
                key={e.id}
                type="button"
                role="option"
                aria-selected={elegido}
                onClick={() => { setEventoId(e.id); setAbierto(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  padding: "10px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: elegido ? "rgba(33,208,179,0.10)" : "transparent", color: SURFACE.text,
                }}
                onMouseEnter={(ev) => { if (!elegido) ev.currentTarget.style.background = SURFACE.borderMuted; }}
                onMouseLeave={(ev) => { if (!elegido) ev.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{e.name || e.id}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                    <Etapa etapa={etapaEvento(e, hoy)} />
                    {rango && <span style={{ fontSize: 11, color: SURFACE.textMuted }}>{rango}</span>}
                  </span>
                </span>
                <span aria-hidden style={{ width: 18, flexShrink: 0, color: BRAND.teal, display: "inline-flex" }}>
                  {elegido && <CheckIcon size={16} />}
                </span>
              </button>
            );
          })}
          <div style={{ borderTop: `1px solid ${SURFACE.border}`, margin: "6px 4px 0", padding: "8px 6px 4px" }}>
            <Link
              href="/registro/eventos"
              onClick={() => setAbierto(false)}
              style={{ fontSize: 12, fontWeight: 600, color: BRAND.teal, textDecoration: "none" }}
            >
              {t("Administrar eventos")} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
