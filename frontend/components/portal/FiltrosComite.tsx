"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "@/components/ui/Icons";
import { BRAND, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { buildDisciplineLabelMap, type DisciplineLike } from "@/lib/discipline-filters";

/**
 * Filtros del Coordinador de Comité: delegación y disciplina.
 *
 * Él ve el evento entero, que son dieciséis regiones por diecisiete deportes.
 * Sin una forma de acotar, cada módulo es una lista interminable. Lo que elige
 * aquí manda en actividades, calendario, sedes y hoteles, para no repetir la
 * selección en cada pestaña.
 *
 * Ocupa una sola fila. Las dos versiones anteriores gastaban la pantalla
 * completa en el filtro: primero fichas en filas que se desplazaban de lado
 * (el borde cortaba los nombres y llegar a Magallanes era arrastrar a ciegas),
 * después un panel desplegable que al abrirse empujaba el contenido fuera de
 * vista. Ahora son dos botones que dicen qué se está mirando, y cada uno abre
 * una hoja inferior con la lista completa y un buscador. El contenido no se
 * mueve, y elegir es un toque para abrir y otro para aplicar.
 */
export type Delegacion = { id: string; countryCode?: string | null; name?: string | null };

/** Las regiones de Chile, de norte a sur: así se listan y así se buscan. */
const ORDEN_REGION = [
  "CL-AP", "CL-TA", "CL-AN", "CL-AT", "CL-CO", "CL-VS", "CL-RM", "CL-LI",
  "CL-ML", "CL-NB", "CL-BI", "CL-AR", "CL-LR", "CL-LL", "CL-AI", "CL-MA",
];
const CORTO: Record<string, string> = {
  "CL-AP": "Arica", "CL-TA": "Tarapacá", "CL-AN": "Antofagasta", "CL-AT": "Atacama",
  "CL-CO": "Coquimbo", "CL-VS": "Valparaíso", "CL-RM": "Metropolitana", "CL-LI": "O'Higgins",
  "CL-ML": "Maule", "CL-NB": "Ñuble", "CL-BI": "Biobío", "CL-AR": "Araucanía",
  "CL-LR": "Los Ríos", "CL-LL": "Los Lagos", "CL-AI": "Aysén", "CL-MA": "Magallanes",
};

export const nombreRegionCorto = (d: Delegacion) =>
  CORTO[d.countryCode ?? ""] ??
  (d.name ?? d.countryCode ?? "—").replace(/^regi[oó]n\s+(de\s+la\s+|del\s+|de\s+)?/i, "").trim();

/** Sin tildes ni mayúsculas, para que "nuble" encuentre Ñuble. */
const plano = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Opcion = { value: string; label: string };

/** Hoja inferior con la lista completa: un toque elige y cierra. */
function HojaOpciones({
  titulo,
  opciones,
  etiquetaTodos,
  valor,
  onElegir,
  onCerrar,
}: {
  titulo: string;
  opciones: Opcion[];
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

  const fila = (o: Opcion) => {
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
          animation: "fc-sheet .25s cubic-bezier(0.16,1,0.3,1) both",
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
      <style>{`@keyframes fc-sheet{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

/** Uno de los dos botones de la barra: rótulo arriba, lo elegido abajo. */
function BotonFiltro({
  rotulo,
  valor,
  activo,
  onClick,
}: {
  rotulo: string;
  valor: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
          {valor}
        </span>
      </span>
      <ChevronDownIcon size={13} color={activo ? BRAND.tealInk : SURFACE.textFaint} />
    </button>
  );
}

export default function FiltrosComite({
  delegaciones,
  disciplinas,
  delegacionId,
  disciplinaId,
  onDelegacion,
  onDisciplina,
  resumen,
}: {
  delegaciones: Delegacion[];
  /** Sólo los deportes padre; las pruebas hijas no se ofrecen como filtro. */
  disciplinas: (DisciplineLike & { parentId?: string | null })[];
  delegacionId: string;
  disciplinaId: string;
  onDelegacion: (id: string) => void;
  onDisciplina: (id: string) => void;
  /** Línea corta bajo los filtros: qué se está viendo ahora mismo. */
  resumen?: string;
}) {
  const { t } = useI18n();
  const [hoja, setHoja] = useState<null | "region" | "deporte">(null);

  const regiones = useMemo<Opcion[]>(
    () =>
      [...delegaciones]
        .sort((a, b) => {
          const ia = ORDEN_REGION.indexOf(a.countryCode ?? "");
          const ib = ORDEN_REGION.indexOf(b.countryCode ?? "");
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        })
        .map((d) => ({ value: d.id, label: nombreRegionCorto(d) })),
    [delegaciones],
  );

  const etiquetas = useMemo(() => buildDisciplineLabelMap(disciplinas), [disciplinas]);
  const deportes = useMemo<Opcion[]>(
    () =>
      [...disciplinas]
        .filter((d) => !d.parentId)
        .map((d) => ({ value: d.id, label: etiquetas.get(d.id) ?? d.name ?? d.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [disciplinas, etiquetas],
  );

  const hayFiltro = Boolean(delegacionId || disciplinaId);
  const nombreRegion = regiones.find((o) => o.value === delegacionId)?.label ?? t("Todas");
  const nombreDeporte = deportes.find((o) => o.value === disciplinaId)?.label ?? t("Todos");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        <BotonFiltro
          rotulo={t("Región")}
          valor={nombreRegion}
          activo={Boolean(delegacionId)}
          onClick={() => setHoja("region")}
        />
        <BotonFiltro
          rotulo={t("Deporte")}
          valor={nombreDeporte}
          activo={Boolean(disciplinaId)}
          onClick={() => setHoja("deporte")}
        />
        {hayFiltro && (
          <button
            type="button"
            aria-label={t("Ver todo")}
            onClick={() => { onDelegacion(""); onDisciplina(""); }}
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
        )}
      </div>

      {resumen && <p style={{ margin: 0, fontSize: 11.5, color: SURFACE.textFaint }}>{resumen}</p>}

      {hoja === "region" && (
        <HojaOpciones
          titulo={t("Región")}
          opciones={regiones}
          etiquetaTodos={t("Todas las regiones")}
          valor={delegacionId}
          onElegir={onDelegacion}
          onCerrar={() => setHoja(null)}
        />
      )}
      {hoja === "deporte" && (
        <HojaOpciones
          titulo={t("Deporte")}
          opciones={deportes}
          etiquetaTodos={t("Todos los deportes")}
          valor={disciplinaId}
          onElegir={onDisciplina}
          onCerrar={() => setHoja(null)}
        />
      )}
    </div>
  );
}
