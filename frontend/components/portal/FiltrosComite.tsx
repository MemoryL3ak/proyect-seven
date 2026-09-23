"use client";

import { useMemo } from "react";
import SelectorFiltro, { BotonQuitarFiltros, type OpcionFiltro } from "@/components/portal/SelectorFiltro";
import { SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { buildDisciplineLabelMap, type DisciplineLike } from "@/lib/discipline-filters";

/**
 * Filtros del Coordinador de Comité: delegación, disciplina y —donde aplica—
 * el hotel y la sede que tocan los traslados.
 *
 * Él ve el evento entero, que son dieciséis regiones por diecisiete deportes.
 * Sin una forma de acotar, cada módulo es una lista interminable. Lo que elige
 * aquí manda en actividades, calendario, sedes y hoteles, para no repetir la
 * selección en cada pestaña.
 *
 * Cada filtro es un botón de una línea que abre su hoja inferior: ver
 * `SelectorFiltro`, que es el mismo control que usa el calendario.
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

export default function FiltrosComite({
  delegaciones,
  disciplinas,
  delegacionId,
  disciplinaId,
  onDelegacion,
  onDisciplina,
  hoteles,
  hotel = "",
  onHotel,
  sedes,
  sede = "",
  onSede,
  resumen,
}: {
  delegaciones: Delegacion[];
  /** Sólo los deportes padre; las pruebas hijas no se ofrecen como filtro. */
  disciplinas: (DisciplineLike & { parentId?: string | null })[];
  delegacionId: string;
  disciplinaId: string;
  onDelegacion: (id: string) => void;
  onDisciplina: (id: string) => void;
  /**
   * Hoteles y sedes que algún traslado toca (sale de ahí o llega ahí). Van
   * sólo donde el filtro significa algo —la lista de traslados—, así que si
   * no se pasan, los botones no aparecen y la barra queda con los dos de
   * siempre. Son textos tal como los escribe la planilla, con la cuenta de
   * viajes en la etiqueta: la misma regla que el tracking del panel (ver
   * lib/lugares), porque los viajes importados no traen id de lugar.
   */
  hoteles?: OpcionFiltro[];
  hotel?: string;
  onHotel?: (texto: string) => void;
  sedes?: OpcionFiltro[];
  sede?: string;
  onSede?: (texto: string) => void;
  /** Línea corta bajo los filtros: qué se está viendo ahora mismo. */
  resumen?: string;
}) {
  const { t } = useI18n();

  const regiones = useMemo<OpcionFiltro[]>(
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
  const deportes = useMemo<OpcionFiltro[]>(
    () =>
      [...disciplinas]
        .filter((d) => !d.parentId)
        .map((d) => ({ value: d.id, label: etiquetas.get(d.id) ?? d.name ?? d.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [disciplinas, etiquetas],
  );

  const conHotel = (hoteles?.length ?? 0) > 0 && Boolean(onHotel);
  const conSede = (sedes?.length ?? 0) > 0 && Boolean(onSede);

  // Qué nombre mostrar en cada botón lo resuelve el propio SelectorFiltro.
  const hayFiltro = Boolean(delegacionId || disciplinaId || (conHotel && hotel) || (conSede && sede));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        <SelectorFiltro
          rotulo={t("Región")}
          opciones={regiones}
          etiquetaTodos={t("Todas las regiones")}
          valor={delegacionId}
          onChange={onDelegacion}
        />
        <SelectorFiltro
          rotulo={t("Deporte")}
          opciones={deportes}
          etiquetaTodos={t("Todos los deportes")}
          valor={disciplinaId}
          onChange={onDisciplina}
        />
        {hayFiltro && (
          <BotonQuitarFiltros
            titulo={t("Ver todo")}
            onClick={() => { onDelegacion(""); onDisciplina(""); onHotel?.(""); onSede?.(""); }}
          />
        )}
      </div>

      {/* Hotel y sede van cada uno en su propia fila: apretados junto a otro
          botón, un nombre como "Hotel LRH § Convention Center (ex Gala)" se
          cortaba a la segunda palabra y el filtro dejaba de decir qué estaba
          aplicado. */}
      {conHotel && (
        <div style={{ display: "flex" }}>
          <SelectorFiltro
            rotulo={t("Hotel")}
            opciones={hoteles ?? []}
            etiquetaTodos={t("Todos los hoteles")}
            valor={hotel}
            onChange={(v) => onHotel?.(v)}
          />
        </div>
      )}
      {conSede && (
        <div style={{ display: "flex" }}>
          <SelectorFiltro
            rotulo={t("Sede")}
            opciones={sedes ?? []}
            etiquetaTodos={t("Todas las sedes")}
            valor={sede}
            onChange={(v) => onSede?.(v)}
          />
        </div>
      )}

      {resumen && <p style={{ margin: 0, fontSize: 11.5, color: SURFACE.textFaint }}>{resumen}</p>}
    </div>
  );
}
