"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "@/components/ui/Icons";
import { BRAND, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { buildDisciplineLabelMap, type DisciplineLike } from "@/lib/discipline-filters";

/**
 * Filtros del Coordinador de Comité: delegación y disciplina.
 *
 * Él ve el evento entero, que son dieciséis regiones por once deportes. Sin
 * una forma de acotar, cada módulo es una lista interminable. Estos dos
 * filtros viajan con él: lo que elige aquí manda en actividades, calendario,
 * sedes y hoteles, para no tener que repetir la selección en cada pestaña.
 *
 * Va plegado. Dieciséis regiones no caben en una fila que se desplaza de
 * lado: para llegar a Magallanes habría que arrastrar a ciegas, y el borde
 * corta los nombres. Plegado ocupa una línea que dice qué se está mirando;
 * abierto muestra las dieciséis a la vez, ordenadas de norte a sur como en
 * cualquier planilla del evento.
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

/** Una ficha del panel. Las de "todas" quedan en gris; la elegida, en verde. */
function Ficha({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 11px",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.2,
        cursor: "pointer",
        borderRadius: 999,
        border: `1px solid ${activo ? BRAND.teal : SURFACE.borderMuted}`,
        background: activo ? BRAND.teal : SURFACE.card,
        color: activo ? "#04241f" : SURFACE.textSecondary,
        transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
      }}
    >
      {children}
    </button>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: SURFACE.textFaint,
      }}
    >
      {children}
    </p>
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
  const [abierto, setAbierto] = useState(false);

  const regiones = useMemo(
    () =>
      [...delegaciones].sort((a, b) => {
        const ia = ORDEN_REGION.indexOf(a.countryCode ?? "");
        const ib = ORDEN_REGION.indexOf(b.countryCode ?? "");
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }),
    [delegaciones],
  );

  const etiquetas = useMemo(() => buildDisciplineLabelMap(disciplinas), [disciplinas]);
  const deportes = useMemo(
    () =>
      [...disciplinas]
        .filter((d) => !d.parentId)
        .map((d) => ({ value: d.id, label: etiquetas.get(d.id) ?? d.name ?? d.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [disciplinas, etiquetas],
  );

  const hayFiltro = Boolean(delegacionId || disciplinaId);
  const nombreElegido = regiones.find((d) => d.id === delegacionId);
  // La línea de arriba responde siempre "¿qué estoy mirando?", esté abierto o no.
  const enUso = hayFiltro
    ? [nombreElegido ? nombreRegionCorto(nombreElegido) : null, disciplinaId ? etiquetas.get(disciplinaId) : null]
        .filter(Boolean)
        .join(" · ")
    : t("Todo el evento");

  return (
    <div
      style={{
        background: SURFACE.card,
        border: `1px solid ${hayFiltro ? "rgba(33,208,179,0.45)" : SURFACE.border}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "11px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: BRAND.tealDark,
            }}
          >
            {t("Qué estás mirando")}
          </span>
          <span
            style={{
              display: "block",
              marginTop: 2,
              fontSize: 14,
              fontWeight: 800,
              color: SURFACE.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {enUso}
          </span>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 11.5,
            fontWeight: 700,
            color: BRAND.tealInk,
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          {abierto ? t("Listo") : t("Filtrar")}
          <span
            style={{
              display: "inline-flex",
              transform: abierto ? "rotate(180deg)" : "none",
              transition: "transform 160ms ease",
            }}
          >
            <ChevronDownIcon size={13} />
          </span>
        </span>
      </button>

      {abierto && (
        <div
          style={{
            padding: "0 14px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            borderTop: `1px solid ${SURFACE.borderMuted}`,
            paddingTop: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Titulo>{t("Región")}</Titulo>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Ficha activo={!delegacionId} onClick={() => onDelegacion("")}>
                {t("Todas")}
              </Ficha>
              {regiones.map((d) => (
                <Ficha key={d.id} activo={d.id === delegacionId} onClick={() => onDelegacion(d.id)}>
                  {nombreRegionCorto(d)}
                </Ficha>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Titulo>{t("Deporte")}</Titulo>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Ficha activo={!disciplinaId} onClick={() => onDisciplina("")}>
                {t("Todos")}
              </Ficha>
              {deportes.map((o) => (
                <Ficha key={o.value} activo={o.value === disciplinaId} onClick={() => onDisciplina(o.value)}>
                  {o.label}
                </Ficha>
              ))}
            </div>
          </div>

          {hayFiltro && (
            <button
              type="button"
              onClick={() => { onDelegacion(""); onDisciplina(""); }}
              style={{
                alignSelf: "flex-start",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontSize: 11.5,
                fontWeight: 700,
                color: BRAND.tealInk,
              }}
            >
              {t("Quitar los filtros")}
            </button>
          )}
        </div>
      )}

      {resumen && !abierto && (
        <p style={{ margin: 0, padding: "0 14px 11px", fontSize: 11.5, color: SURFACE.textFaint }}>{resumen}</p>
      )}
    </div>
  );
}
