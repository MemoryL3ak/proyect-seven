"use client";

import { useEffect, useMemo, useState } from "react";
import TarjetaLugar from "@/components/portal/TarjetaLugar";
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
  photoUrl?: string | null;
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
  /** Ficha abierta, una a la vez: igual que el listado de sedes. */
  const [abierto, setAbierto] = useState<string | null>(null);

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

  /**
   * Una "selección" es una fila de la planilla de distribución
   * (`logistics.delegation_hotels`): una región con una disciplina. La
   * disciplina ya viene separada por género y categoría, así que en las de un
   * solo género hay una fila; en las mixtas (ajedrez, atletismo, ciclismo,
   * judo, natación, tenis de mesa) hay dos, damas y varones, porque pueden
   * dormir en hoteles distintos. Sin decirlo, el total parecía un recuento de
   * personas.
   */
  const resumen = useMemo(() => {
    const filas = [...porHotel.values()].flat();
    return {
      total: filas.length,
      regiones: new Set(filas.map((f) => f.region)).size,
      disciplinas: new Set(filas.map((f) => f.deporte)).size,
    };
  }, [porHotel]);

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
          {resumen.total > 0
            ? ` · ${resumen.regiones} ${resumen.regiones === 1 ? t("región") : t("regiones")} · ${resumen.disciplinas} ${resumen.disciplinas === 1 ? t("disciplina") : t("disciplinas")}`
            : ""}
        </p>
        {resumen.total > 0 && (
          <p style={{ fontSize: 10.5, color: SURFACE.textFaint, margin: "2px 0 0" }}>
            {resumen.total} {t("asignaciones de región + disciplina (las mixtas se reparten en damas y varones)")}
          </p>
        )}
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
        const porRegion = new Map<string, string[]>();
        for (const s of selecciones) {
          const lista = porRegion.get(s.region) ?? [];
          lista.push([s.deporte, s.rama].filter(Boolean).join(" · "));
          porRegion.set(s.region, lista);
        }
        const regiones = [...porRegion.entries()];
        const deportes = new Set(selecciones.map((s) => s.deporte));
        const resumen = [
          `${selecciones.length} ${selecciones.length === 1 ? t("selección") : t("selecciones")}`,
          `${regiones.length} ${regiones.length === 1 ? t("región") : t("regiones")}`,
          `${deportes.size} ${deportes.size === 1 ? t("deporte") : t("deportes")}`,
        ].join(" · ");

        return (
          <TarjetaLugar
            key={h.id}
            nombre={h.name ?? "—"}
            direccion={h.address}
            foto={h.photoUrl}
            tipo="hotel"
            // En la fila, una ficha por región con su cantidad; el detalle
            // completo queda para la ficha abierta.
            etiquetas={regiones.map(([region, items]) => `${region} (${items.length})`)}
            coordinador={h.contactPhone ? { telefono: h.contactPhone, rotulo: t("Contacto del hotel") } : null}
            datos={[
              ...(selecciones.length > 0
                ? [{ etiqueta: t("Alojados"), valor: resumen, ancho: true }]
                : []),
              // Cada región encabeza sus propios deportes, en vez de repetir su
              // nombre en cada línea.
              ...regiones.map(([region, items]) => ({
                etiqueta: region,
                valor: items.join(" · "),
                ancho: true,
              })),
            ]}
            abierta={abierto === h.id}
            onToggle={() => setAbierto(abierto === h.id ? null : h.id)}
          />
        );
      })}

    </div>
  );
}
