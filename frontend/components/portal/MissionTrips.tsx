"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, CarIcon, ChevronDownIcon, UsersIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { BRAND, SURFACE, tripStatusMeta } from "@/lib/design";
import { buildDisciplineLabelMap, type DisciplineLike } from "@/lib/discipline-filters";
import TripMap from "@/components/TripMap";
import { ChipFilter, SegmentedFilter } from "@/components/ui/FilterControls";
import { useI18n } from "@/lib/i18n";

/**
 * Viajes de la delegación para el Jefe de Misión. El traslado se asigna al
 * grupo (región + disciplina), así que la lista se ordena por hora, se puede
 * filtrar por disciplina y por estado, y cada tarjeta dice a qué disciplina
 * corresponde y a qué recinto va (nombre de la sede u hotel, no la dirección).
 */
export type MissionTrip = {
  id: string;
  status?: string | null;
  origin?: string | null;
  destination?: string | null;
  originVenueId?: string | null;
  originHotelId?: string | null;
  destinationVenueId?: string | null;
  destinationHotelId?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  discipline?: string | null;
  disciplineId?: string | null;
  delegationId?: string | null;
  requesterAthleteId?: string | null;
  athleteIds?: string[];
  athleteNames?: string[];
  passengerCount?: number | null;
  driverId?: string | null;
  vehiclePlate?: string | null;
  notes?: string | null;
};

type NamedPlace = { id: string; name?: string | null };
type DriverRow = { id: string; userId?: string | null; fullName?: string | null; phone?: string | null };

const ACTIVOS = new Set(["SCHEDULED", "REQUESTED", "EN_ROUTE", "PICKED_UP"]);
/**
 * Los que están andando ahora mismo. "Por realizar" los mete en el mismo saco
 * que los de pasado mañana, así que un bus en ruta quedaba perdido entre los
 * programados y sólo se distinguía por el color de su chip.
 */
const EN_CURSO = new Set(["EN_ROUTE", "PICKED_UP"]);
const norm = (v?: string | null) => String(v ?? "").trim().toUpperCase();

const fechaCorta = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }).replace(".", "") : "—";
const hora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--";

const chip = (bg: string, color: string): React.CSSProperties => ({
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  background: bg,
  color,
  whiteSpace: "nowrap",
});

export default function MissionTrips({
  trips,
  delegationId,
  delegationName,
  memberIds,
  disciplines,
  venues,
  accommodations,
  estado,
  onEstado,
}: {
  trips: MissionTrip[];
  delegationId?: string | null;
  /** Región del jefe: la lista está acotada a ella. */
  delegationName?: string;
  memberIds: string[];
  disciplines: DisciplineLike[];
  venues: NamedPlace[];
  accommodations: NamedPlace[];
  /** Filtro de estado mandado desde fuera (el banner "En curso ahora"). */
  estado?: string;
  onEstado?: (valor: string) => void;
}) {
  const { t } = useI18n();
  const [disciplinaFiltro, setDisciplinaFiltro] = useState("");
  const [estadoInterno, setEstadoInterno] = useState("ACTIVOS");
  // Si quien usa la lista lleva el filtro, manda él; si no, el de aquí.
  const estadoFiltro = estado ?? estadoInterno;
  const setEstadoFiltro = (valor: string) => {
    setEstadoInterno(valor);
    onEstado?.(valor);
  };
  const [abierto, setAbierto] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverRow[] | null>(null);

  const labels = useMemo(() => buildDisciplineLabelMap(disciplines), [disciplines]);
  const lugar = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of venues) if (v.id && v.name) map.set(v.id, v.name);
    for (const a of accommodations) if (a.id && a.name) map.set(a.id, a.name);
    return map;
  }, [venues, accommodations]);

  // Nombre del recinto cuando el viaje lo tiene asignado; si no, la dirección.
  const puntoOrigen = (tr: MissionTrip) =>
    lugar.get(tr.originVenueId ?? "") ?? lugar.get(tr.originHotelId ?? "") ?? tr.origin ?? "—";
  const puntoDestino = (tr: MissionTrip) =>
    lugar.get(tr.destinationVenueId ?? "") ?? lugar.get(tr.destinationHotelId ?? "") ?? tr.destination ?? "—";

  const disciplinaDe = (tr: MissionTrip) =>
    (tr.disciplineId ? labels.get(tr.disciplineId) : null) ?? tr.discipline ?? null;

  const miembros = useMemo(() => new Set(memberIds), [memberIds]);
  const propios = useMemo(
    () =>
      trips.filter(
        (tr) =>
          (tr.delegationId && tr.delegationId === delegationId) ||
          (tr.requesterAthleteId && miembros.has(tr.requesterAthleteId)) ||
          (tr.athleteIds ?? []).some((id) => miembros.has(id)),
      ),
    [trips, delegationId, miembros],
  );

  const hayEnCurso = useMemo(
    () => propios.some((tr) => EN_CURSO.has(norm(tr.status))),
    [propios],
  );

  // Disciplinas presentes, para no ofrecer filtros vacíos.
  const opcionesDisciplina = useMemo(() => {
    const vistas = new Map<string, { label: string; total: number }>();
    for (const tr of propios) {
      const label = disciplinaDe(tr);
      if (!label) continue;
      const clave = tr.disciplineId ?? label;
      const previo = vistas.get(clave);
      vistas.set(clave, { label, total: (previo?.total ?? 0) + 1 });
    }
    return [...vistas.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [propios, labels]);

  const visibles = useMemo(() => {
    const list = propios.filter((tr) => {
      if (disciplinaFiltro) {
        const clave = tr.disciplineId ?? disciplinaDe(tr) ?? "";
        if (clave !== disciplinaFiltro) return false;
      }
      const suEstado = norm(tr.status);
      if (estadoFiltro === "EN_CURSO") return EN_CURSO.has(suEstado);
      if (estadoFiltro === "ACTIVOS") return ACTIVOS.has(suEstado);
      if (estadoFiltro === "TERMINADOS") return !ACTIVOS.has(suEstado);
      return true;
    });
    // Del más temprano al más tarde, sin excepciones: el jefe lee la jornada
    // de corrido. Los viajes sin hora quedan al final.
    return list.sort((a, b) => {
      const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
      const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
      return ta - tb;
    });
  }, [propios, disciplinaFiltro, estadoFiltro, labels]);

  // Los conductores se piden una sola vez, y sólo si hay viajes con chofer.
  useEffect(() => {
    if (drivers !== null) return;
    if (!propios.some((tr) => tr.driverId)) return;
    void apiFetch<DriverRow[]>("/drivers")
      .then((d) => setDrivers(Array.isArray(d) ? d : []))
      .catch(() => setDrivers([]));
  }, [propios, drivers]);

  const chofer = (tr: MissionTrip) =>
    tr.driverId ? (drivers ?? []).find((d) => d.id === tr.driverId || d.userId === tr.driverId)?.fullName ?? null : null;

  return (
    <div style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${SURFACE.borderMuted}` }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: BRAND.teal, margin: 0 }}>
          {t("Viajes de mi delegación")}
        </p>
        <p style={{ fontSize: 11.5, color: SURFACE.textFaint, margin: "3px 0 0" }}>
          {delegationName ? `${delegationName} · ` : ""}
          {visibles.length} {visibles.length === 1 ? t("traslado") : t("traslados")}
          {estadoFiltro === "ACTIVOS" ? ` · ${t("por realizar")}` : ""}
          {estadoFiltro === "EN_CURSO" ? ` · ${t("en curso")}` : ""}
        </p>
        <SegmentedFilter
          style={{ marginTop: 10 }}
          value={estadoFiltro}
          onChange={setEstadoFiltro}
          options={[
            // "En curso" sólo se ofrece cuando hay algo andando: un filtro
            // que siempre da vacío estorba más de lo que ayuda.
            ...(hayEnCurso ? [{ value: "EN_CURSO", label: t("En curso") }] : []),
            { value: "ACTIVOS", label: t("Por realizar") },
            { value: "TERMINADOS", label: t("Terminados") },
            { value: "TODOS", label: t("Todos") },
          ]}
        />
        {/* Disciplina: fichas desplazables. */}
        {opcionesDisciplina.length > 0 && (
          <ChipFilter
            style={{ marginTop: 8 }}
            value={disciplinaFiltro}
            onChange={setDisciplinaFiltro}
            allLabel={t("Todas")}
            options={opcionesDisciplina.map(([value, { label, total }]) => ({ value, label, count: total }))}
          />
        )}
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {visibles.length === 0 && (
          <p style={{ fontSize: 13, color: SURFACE.textFaint, margin: 0, textAlign: "center", padding: 10 }}>
            {propios.length === 0
              ? t("Tu delegación aún no tiene traslados asignados.")
              : t("Ningún traslado coincide con el filtro.")}
          </p>
        )}

        {visibles.slice(0, 50).map((tr) => {
          const st = tripStatusMeta(tr.status);
          const disciplina = disciplinaDe(tr);
          const abiertaEsta = abierto === tr.id;
          const pasajeros = (tr.athleteNames ?? []).filter(Boolean);
          const nombreChofer = chofer(tr);
          return (
            <div
              key={tr.id}
              onClick={() => setAbierto((prev) => (prev === tr.id ? null : tr.id))}
              style={{
                display: "flex",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 12,
                cursor: "pointer",
                background: abiertaEsta ? SURFACE.card : SURFACE.bg,
                border: `1px solid ${abiertaEsta ? "rgba(33,208,179,0.35)" : SURFACE.borderMuted}`,
                transition: "all 150ms ease",
              }}
            >
              {/* Hora: es lo primero que busca un jefe de misión. */}
              <div style={{ width: 52, flexShrink: 0, textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: SURFACE.text, margin: 0, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                  {hora(tr.scheduledAt)}
                </p>
                <p style={{ fontSize: 10.5, color: SURFACE.textFaint, margin: "2px 0 0", textTransform: "uppercase" }}>
                  {fechaCorta(tr.scheduledAt)}
                </p>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={chip(st.bg, st.color)}>{t(st.label)}</span>
                  {disciplina && <span style={chip("rgba(33,208,179,0.12)", BRAND.tealInk)}>{disciplina}</span>}
                  <span style={{ marginLeft: "auto", display: "flex", color: SURFACE.textFaint, transform: abiertaEsta ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}>
                    <ChevronDownIcon size={14} strokeWidth={2.2} />
                  </span>
                </div>

                <p style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text, margin: 0, ...(abiertaEsta ? {} : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) }}>
                  {puntoOrigen(tr)} → {puntoDestino(tr)}
                </p>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                  {(nombreChofer || tr.vehiclePlate) && (
                    <span style={{ fontSize: 11, color: SURFACE.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CarIcon size={11} /> {nombreChofer ?? t("Sin chofer")}
                      {tr.vehiclePlate ? ` · ${tr.vehiclePlate}` : ""}
                    </span>
                  )}
                  {(tr.passengerCount || pasajeros.length > 0) && (
                    <span style={{ fontSize: 11, color: SURFACE.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <UsersIcon size={11} /> {tr.passengerCount ?? pasajeros.length} {t("personas")}
                    </span>
                  )}
                </div>

                {abiertaEsta && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${SURFACE.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Mapa del recorrido: el jefe necesita ubicar el traslado. */}
                    {(tr.origin || tr.destination) && (
                      <div style={{ borderRadius: 10, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
                        <TripMap origin={tr.origin} destination={tr.destination} height={170} />
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", color: SURFACE.textFaint, margin: 0 }}>{t("ORIGEN")}</p>
                      <p style={{ fontSize: 12, color: SURFACE.textStrong, margin: "1px 0 0" }}>{tr.origin || puntoOrigen(tr)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", color: SURFACE.textFaint, margin: 0 }}>{t("DESTINO")}</p>
                      <p style={{ fontSize: 12, color: SURFACE.textStrong, margin: "1px 0 0" }}>{tr.destination || puntoDestino(tr)}</p>
                    </div>
                    {tr.completedAt && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: SURFACE.textMuted }}>{t("Completado")}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: BRAND.tealInk }}>
                          {new Date(tr.completedAt).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    )}
                    {pasajeros.length > 0 && (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SURFACE.textFaint, margin: "0 0 4px" }}>
                          {t("Pasajeros")} · {pasajeros.length}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {pasajeros.map((n) => (
                            <span key={n} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: "rgba(33,208,179,0.08)", color: BRAND.tealInk, border: "1px solid rgba(33,208,179,0.18)" }}>
                              {n}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {tr.notes && (
                      <p style={{ fontSize: 11, color: SURFACE.textMuted, margin: 0, fontStyle: "italic" }}>{tr.notes}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {visibles.length > 50 && (
          <p style={{ fontSize: 11, color: SURFACE.textFaint, textAlign: "center", margin: 0 }}>
            <CalendarIcon size={11} /> {t("Se muestran los 50 más próximos.")}
          </p>
        )}
      </div>
    </div>
  );
}
