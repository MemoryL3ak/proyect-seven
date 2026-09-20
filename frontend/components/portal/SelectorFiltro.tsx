"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "@/components/ui/Icons";
import { BRAND, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";

/**
 * Filtro de una sola línea con hoja inferior.
 *
 * En un teléfono, una lista de fichas para elegir gasta la pantalla entera:
 * si se desplazan de lado el borde corta los nombres y hay que arrastrar a
 * ciegas; si se envuelven, empujan el contenido fuera de vista. Este botón
 * ocupa una fila, dice qué se está mirando, y al tocarlo sube una hoja con
 * la lista completa y un buscador. El contenido no se mueve, y elegir es un
 * toque para abrir y otro para aplicar.
 *
 * Lo usan los filtros del Coordinador de Comité y los del calendario.
 */
export type OpcionFiltro = { value: string; label: string };

/** Sin tildes ni mayúsculas, para que "nuble" encuentre Ñuble. */
const plano = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function HojaOpciones({
  titulo,
  opciones,
  etiquetaTodos,
  valor,
  onElegir,
  onCerrar,
}: {
  titulo: string;
  opciones: OpcionFiltro[];
  etiquetaTodos: string;
  valor: string;
  onElegir: (value: string) => void;
  onCerrar: () => void;
}) {
  const { t } = useI18n();
  const [busca, setBusca] = useState("");
  // Con pocas opciones el buscador estorba más de lo que ayuda.
  const hayBuscador = opciones.length > 10;

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", alTeclear);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = previo;
    };
  }, [onCerrar]);

  const visibles = useMemo(() => {
    const q = plano(busca.trim());
    return q ? opciones.filter((o) => plano(o.label).includes(q)) : opciones;
  }, [opciones, busca]);

  const fila = (o: OpcionFiltro) => {
    const activo = o.value === valor;
    return (
      <button
        key={o.value || "__todas"}
        type="button"
        onClick={() => { onElegir(o.value); onCerrar(); }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "13px 4px",
          background: "none",
          border: "none",
          borderBottom: `1px solid ${SURFACE.borderMuted}`,
          cursor: "pointer",
          textAlign: "left",
          fontSize: 14,
          fontWeight: activo ? 800 : 600,
          color: activo ? BRAND.tealInk : SURFACE.text,
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>{o.label}</span>
        {activo && <CheckIcon size={16} color={BRAND.teal} strokeWidth={2.5} />}
      </button>
    );
  };

  return (
    <div
      onClick={onCerrar}
      style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "flex-end", background: "rgba(2,12,24,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "78vh",
          display: "flex",
          flexDirection: "column",
          background: SURFACE.card,
          borderRadius: "22px 22px 0 0",
          padding: "10px 16px calc(14px + env(safe-area-inset-bottom,0px))",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.25)",
          animation: "sf-hoja .25s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 99, background: SURFACE.border, margin: "0 auto 12px", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexShrink: 0 }}>
          <p style={{ flex: 1, fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: SURFACE.textFaint, margin: 0 }}>
            {titulo}
          </p>
          <button
            type="button"
            onClick={onCerrar}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: BRAND.tealInk }}
          >
            {t("Cerrar")}
          </button>
        </div>

        {hayBuscador && (
          <div style={{ position: "relative", marginBottom: 6, flexShrink: 0 }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: SURFACE.textFaint, display: "flex" }}>
              <SearchIcon size={14} />
            </span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={t("Buscar…")}
              style={{
                width: "100%",
                padding: "10px 12px 10px 33px",
                borderRadius: 11,
                border: `1px solid ${SURFACE.border}`,
                background: SURFACE.bg,
                // 16px: cualquier cosa menor hace que iOS acerque la pantalla.
                fontSize: 16,
                color: SURFACE.text,
                outline: "none",
              }}
            />
          </div>
        )}

        <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {fila({ value: "", label: etiquetaTodos })}
          {visibles.map(fila)}
          {visibles.length === 0 && (
            <p style={{ fontSize: 13, color: SURFACE.textFaint, textAlign: "center", padding: 18, margin: 0 }}>
              {t("Nada coincide con lo que buscas.")}
            </p>
          )}
        </div>
      </div>
      <style>{`@keyframes sf-hoja{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

/** El botón de la barra: rótulo arriba, lo elegido abajo, y su hoja. */
export default function SelectorFiltro({
  rotulo,
  titulo,
  opciones,
  etiquetaTodos,
  valor,
  onChange,
}: {
  /** Qué se filtra: "Región", "Deporte", "Tipo". */
  rotulo: string;
  /** Encabezado de la hoja; por defecto, el mismo rótulo. */
  titulo?: string;
  opciones: OpcionFiltro[];
  /** Texto de la opción que quita el filtro: "Todas las regiones". */
  etiquetaTodos: string;
  valor: string;
  onChange: (value: string) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const activo = Boolean(valor);
  const elegido = opciones.find((o) => o.value === valor)?.label ?? etiquetaTodos;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 11px",
          borderRadius: 12,
          cursor: "pointer",
          textAlign: "left",
          background: activo ? "rgba(33,208,179,0.10)" : SURFACE.card,
          border: `1px solid ${activo ? "rgba(33,208,179,0.45)" : SURFACE.border}`,
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: activo ? BRAND.tealDark : SURFACE.textFaint }}>
            {rotulo}
          </span>
          <span style={{ display: "block", marginTop: 1, fontSize: 13, fontWeight: 700, color: activo ? BRAND.tealInk : SURFACE.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {elegido}
          </span>
        </span>
        <ChevronDownIcon size={13} color={activo ? BRAND.tealInk : SURFACE.textFaint} />
      </button>

      {abierta && (
        <HojaOpciones
          titulo={titulo ?? rotulo}
          opciones={opciones}
          etiquetaTodos={etiquetaTodos}
          valor={valor}
          onElegir={onChange}
          onCerrar={() => setAbierta(false)}
        />
      )}
    </>
  );
}

/** Botón redondo para volver a verlo todo, al final de la barra. */
export function BotonQuitarFiltros({ onClick, titulo }: { onClick: () => void; titulo: string }) {
  return (
    <button
      type="button"
      aria-label={titulo}
      title={titulo}
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 38,
        borderRadius: 12,
        border: `1px solid ${SURFACE.border}`,
        background: SURFACE.card,
        cursor: "pointer",
        color: SURFACE.textMuted,
        fontSize: 15,
        lineHeight: 1,
      }}
    >
      ×
    </button>
  );
}
