"use client";

import { useEffect, useMemo, useState } from "react";
import { BedIcon, PinIcon, UsersIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { BRAND, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { buildDisciplineLabelMap, type DisciplineLike } from "@/lib/discipline-filters";
import { nombreRegionCorto, type Delegacion } from "@/components/portal/FiltrosComite";

/**
 * Hoteles del evento para el Coordinador de Comité.
 *
 * No es un listado de hoteles: es quién duerme en cada uno. La distribución se
 * decide por región y deporte (la planilla de damas y varones), así que cada
 * hotel se muestra con las selecciones que aloja. Con los filtros de arriba se
 * responde la pregunta al revés: "¿dónde duerme el vóleibol de Ñuble?".
 */
type Hotel = {
  id: string;
  eventId?: string | null;
  name?: string | null;
  address?: string | null;
  contactPhone?: string | null;
};
type Celda = {
  delegationId: string;
  disciplineId: string;
  branch: "DAMAS" | "VARONES";
  accommodationId: string | null;
};

export default function HotelesComite({
  eventId,
  hoteles,
  delegaciones,
  disciplinas,
  delegacionFiltro,
  disciplinaFiltro,
}: {
  eventId?: string | null;
  hoteles: Hotel[];
  delegaciones: Delegacion[];
  disciplinas: (DisciplineLike & { parentId?: string | null })[];
  delegacionFiltro: string;
  disciplinaFiltro: string;
}) {
  const { t } = useI18n();
  const [celdas, setCeldas] = useState<Celda[] | null>(null);
  const [fallo, setFallo] = useState(false);
  /** Hoteles con el detalle por región desplegado. */
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const alternarHotel = (id: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    if (!eventId) return;
    let vivo = true;
    void apiFetch<Celda[]>(`/delegation-hotels?eventId=${encodeURIComponent(eventId)}`)
      .then((filas) => { if (vivo) { setCeldas(Array.isArray(filas) ? filas : []); setFallo(false); } })
      .catch(() => { if (vivo) { setCeldas([]); setFallo(true); } });
    return () => { vivo = false; };
  }, [eventId]);

  const nombreRegion = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of delegaciones) m.set(d.id, nombreRegionCorto(d));
    return m;
  }, [delegaciones]);

  const etiquetaDeporte = useMemo(() => buildDisciplineLabelMap(disciplinas), [disciplinas]);
  /**
   * En los deportes que ya vienen separados por género, la etiqueta dice
   * "Futsal · Femenino" y añadir "Damas" repite lo mismo. La rama sólo aporta
   * en los mixtos, que son los que pueden repartirse entre dos hoteles.
   */
  const esMixto = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const d of disciplinas) {
      const g = String(d.gender ?? "").toUpperCase();
      m.set(d.id, g !== "FEMALE" && g !== "MALE");
    }
    return m;
  }, [disciplinas]);

  /** Selecciones por hotel, ya filtradas por lo que el coordinador eligió arriba. */
  const porHotel = useMemo(() => {
    const m = new Map<string, { region: string; deporte: string; rama: string }[]>();
    for (const c of celdas ?? []) {
      if (!c.accommodationId) continue;
      if (delegacionFiltro && c.delegationId !== delegacionFiltro) continue;
      if (disciplinaFiltro && c.disciplineId !== disciplinaFiltro) continue;
      const lista = m.get(c.accommodationId) ?? [];
      lista.push({
        region: nombreRegion.get(c.delegationId) ?? "—",
        deporte: etiquetaDeporte.get(c.disciplineId) ?? "—",
        rama: esMixto.get(c.disciplineId) ? (c.branch === "DAMAS" ? t("Damas") : t("Varones")) : "",
      });
      m.set(c.accommodationId, lista);
    }
    for (const lista of m.values()) {
      lista.sort((a, b) => a.region.localeCompare(b.region) || a.deporte.localeCompare(b.deporte));
    }
    return m;
  }, [celdas, delegacionFiltro, disciplinaFiltro, nombreRegion, etiquetaDeporte, esMixto, t]);

  const visibles = useMemo(() => {
    const delEvento = hoteles.filter((h) => !eventId || h.eventId === eventId);
    const conGente = delEvento.filter((h) => (porHotel.get(h.id)?.length ?? 0) > 0);
    // Con filtro puesto sólo interesan los hoteles que alojan esa selección;
    // sin filtro se listan todos, incluso los que aún no tienen a nadie.
    const base = delegacionFiltro || disciplinaFiltro ? conGente : delEvento;
    return [...base].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [hoteles, eventId, porHotel, delegacionFiltro, disciplinaFiltro]);

  const totalSelecciones = useMemo(
    () => [...porHotel.values()].reduce((n, l) => n + l.length, 0),
    [porHotel],
  );

  if (celdas === null) {
    return <p style={{ fontSize: 13, color: SURFACE.textFaint, textAlign: "center", padding: 18 }}>{t("Cargando…")}</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, padding: "12px 14px" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: BRAND.teal, margin: 0 }}>
          {t("Hoteles del evento")}
        </p>
        <p style={{ fontSize: 11.5, color: SURFACE.textFaint, margin: "3px 0 0" }}>
          {visibles.length} {visibles.length === 1 ? t("hotel") : t("hoteles")}
          {totalSelecciones > 0 ? ` · ${totalSelecciones} ${totalSelecciones === 1 ? t("selección alojada") : t("selecciones alojadas")}` : ""}
        </p>
        {fallo && (
          <p style={{ fontSize: 11.5, color: SURFACE.textMuted, margin: "6px 0 0" }}>
            {t("No se pudo leer la distribución por región y deporte; se muestran los hoteles sin su detalle.")}
          </p>
        )}
      </div>

      {visibles.length === 0 && (
        <p style={{ fontSize: 13, color: SURFACE.textFaint, textAlign: "center", padding: 18 }}>
          {t("Ninguna selección alojada coincide con el filtro.")}
        </p>
      )}

      {visibles.map((h) => {
        const selecciones = porHotel.get(h.id) ?? [];
        // Las selecciones se agrupan por región: un hotel con 22 llegaba como
        // una pared de fichas "Región · Deporte · Rama" imposible de leer, y
        // repetía el nombre de la región en cada una. La región manda, porque
        // es como se reparte el alojamiento.
        const porRegion = new Map<string, { deporte: string; rama: string }[]>();
        for (const s of selecciones) {
          const lista = porRegion.get(s.region) ?? [];
          lista.push({ deporte: s.deporte, rama: s.rama });
          porRegion.set(s.region, lista);
        }
        const regiones = [...porRegion.entries()];
        const deportes = new Set(selecciones.map((s) => s.deporte));
        const abierto = expandidos.has(h.id);
        return (
          <div key={h.id} style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, background: "rgba(33,208,179,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BedIcon size={16} color={BRAND.teal} strokeWidth={2} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: SURFACE.text, margin: 0 }}>{h.name ?? "—"}</p>
                {h.address && (
                  <p style={{ fontSize: 11.5, color: SURFACE.textMuted, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                    <PinIcon size={11} /> {h.address}
                  </p>
                )}
                <p style={{ fontSize: 11, color: SURFACE.textFaint, margin: "4px 0 0", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  <UsersIcon size={11} />
                  {selecciones.length === 0
                    ? t("Sin selecciones asignadas")
                    : [
                        `${selecciones.length} ${selecciones.length === 1 ? t("selección") : t("selecciones")}`,
                        `${regiones.length} ${regiones.length === 1 ? t("región") : t("regiones")}`,
                        `${deportes.size} ${deportes.size === 1 ? t("deporte") : t("deportes")}`,
                      ].join(" · ")}
                </p>
              </div>
            </div>

            {selecciones.length > 0 && !abierto && (
              // Plegado: una ficha por región con su cantidad, en vez de una
              // por cada combinación región+deporte+rama.
              <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 5 }}>
                {regiones.map(([region, items]) => (
                  <span
                    key={region}
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: SURFACE.bg,
                      border: `1px solid ${SURFACE.borderMuted}`,
                      color: SURFACE.textSecondary,
                      whiteSpace: "nowrap",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {region}
                    <span style={{ color: BRAND.teal, fontWeight: 800 }}>{items.length}</span>
                  </span>
                ))}
              </div>
            )}

            {selecciones.length > 0 && abierto && (
              // Desplegado: la región como encabezado y sus deportes debajo,
              // sin repetir el nombre de la región en cada línea.
              <div style={{ padding: "0 14px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                {regiones.map(([region, items]) => (
                  <div key={region}>
                    <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: BRAND.teal, margin: "0 0 4px" }}>
                      {region}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {items.map((s, i) => (
                        <span
                          key={`${s.deporte}-${s.rama}-${i}`}
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: SURFACE.bg,
                            border: `1px solid ${SURFACE.borderMuted}`,
                            color: SURFACE.textSecondary,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {[s.deporte, s.rama].filter(Boolean).join(" · ")}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selecciones.length > 0 && (
              <button
                type="button"
                onClick={() => alternarHotel(h.id)}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderTop: `1px solid ${SURFACE.borderMuted}`,
                  padding: "9px 14px",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: BRAND.teal,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                {abierto ? t("Ocultar detalle") : t("Ver qué deporte va en cada región")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
