"use client";

import { useEffect, useMemo, useState } from "react";
import { CarIcon, ChevronRightIcon, UsersIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { BRAND, SURFACE, tripStatusMeta } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { horaEvento } from "@/lib/hora-evento";
import { mapaDeLugares } from "@/lib/lugares";
import { legTypeShort } from "@/lib/tripTypes";
import type { MissionTrip } from "@/components/portal/MissionTrips";

/**
 * Lo que se está moviendo AHORA en la delegación, arriba de todo.
 *
 * Antes aquí había una tarjeta con un solo viaje, elegida por una regla
 * interna. En este evento los traslados se asignan a la delegación y el jefe
 * queda como quien los pide, así que esa tarjeta mostraba uno cualquiera de
 * los viajes de la región y llamaba "tuyo" a un bus con 46 personas. Con tres
 * buses andando a la vez, el jefe veía uno y los otros dos en ninguna parte.
 *
 * Este bloque no pretende mostrarlos todos: dice cuántos hay y enseña los tres
 * que salieron antes; tocando uno se abre el mapa en vivo centrado en ese bus,
 * sin salir de Actividades. Funciona igual con uno que con veinte, y cuando no
 * hay ninguno en ruta no ocupa pantalla.
 *
 * El encabezado dice "Ahora mismo" y no "En curso" porque el chip morado de
 * PICKED_UP ya se llama "En curso" en toda la plataforma: dos cosas distintas
 * con el mismo nombre en la misma tarjeta se leen mal.
 */

/** En ruta hacia el punto de recogida, o ya con la gente arriba. */
const EN_CURSO = new Set(["EN_ROUTE", "PICKED_UP"]);
/** Cuántos se enseñan antes de mandar a la lista. */
const VISIBLES = 3;

type DriverRow = { id: string; userId?: string | null; fullName?: string | null };
type NamedPlace = { id: string; name?: string | null; venueType?: string | null };

export default function MissionLiveTrips({
  trips,
  delegationId,
  memberIds,
  venues,
  accommodations,
  comedores = [],
  onVerEnVivo,
}: {
  trips: MissionTrip[];
  delegationId?: string | null;
  memberIds: string[];
  venues: NamedPlace[];
  accommodations: NamedPlace[];
  /** Comedores de Alimentación: el viaje puede apuntar a ellos por id. */
  comedores?: NamedPlace[];
  /**
   * Abre el seguimiento en vivo. Con un traslado, centra el mapa en su bus;
   * sin ninguno, muestra la flota entera.
   */
  onVerEnVivo: (tripId?: string | null) => void;
}) {
  const { t } = useI18n();
  const [drivers, setDrivers] = useState<DriverRow[] | null>(null);

  const miembros = useMemo(() => new Set(memberIds), [memberIds]);
  const enCurso = useMemo(() => {
    return trips
      .filter(
        (tr) =>
          EN_CURSO.has(String(tr.status ?? "").trim().toUpperCase()) &&
          (tr.allDelegations ||
            (tr.delegationId && tr.delegationId === delegationId) ||
            (tr.requesterAthleteId && miembros.has(tr.requesterAthleteId)) ||
            (tr.athleteIds ?? []).some((id) => miembros.has(id))),
      )
      .sort((a, b) => {
        const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
        const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
        return ta - tb;
      });
  }, [trips, delegationId, miembros]);

  // "Comedor LRH (ex Gala)", "Sede Elías Figueroa", "Hotel Mahía".
  const lugar = useMemo(() => mapaDeLugares(venues, accommodations, comedores), [venues, accommodations, comedores]);

  const origen = (tr: MissionTrip) =>
    lugar.get(tr.originVenueId ?? "") ?? lugar.get(tr.originHotelId ?? "") ?? tr.origin ?? "—";
  const destino = (tr: MissionTrip) =>
    lugar.get(tr.destinationVenueId ?? "") ?? lugar.get(tr.destinationHotelId ?? "") ?? tr.destination ?? "—";

  // Los conductores se piden una sola vez, y sólo si hay algo en ruta.
  useEffect(() => {
    if (drivers !== null) return;
    if (!enCurso.some((tr) => tr.driverId)) return;
    void apiFetch<DriverRow[]>("/drivers")
      .then((d) => setDrivers(Array.isArray(d) ? d : []))
      .catch(() => setDrivers([]));
  }, [enCurso, drivers]);

  const chofer = (tr: MissionTrip) =>
    tr.driverId
      ? (drivers ?? []).find((d) => d.id === tr.driverId || d.userId === tr.driverId)?.fullName ?? null
      : null;

  // Nada en ruta: el banner desaparece en vez de ocupar pantalla con un
  // "sin viajes activos" que no le sirve a nadie.
  if (enCurso.length === 0) return null;

  const mostrados = enCurso.slice(0, VISIBLES);
  const resto = enCurso.length - mostrados.length;

  return (
    <div
      style={{
        background: SURFACE.card,
        borderRadius: 14,
        border: `1px solid rgba(33,208,179,0.35)`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "11px 14px",
          borderBottom: `1px solid ${SURFACE.borderMuted}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: BRAND.teal,
            boxShadow: "0 0 0 3px rgba(33,208,179,0.22)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: BRAND.tealDark,
          }}
        >
          {t("Ahora mismo")}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11.5,
            fontWeight: 700,
            color: SURFACE.textSecondary,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {enCurso.length} {enCurso.length === 1 ? t("traslado") : t("traslados")}
        </span>
      </div>

      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {mostrados.map((tr) => {
          const st = tripStatusMeta(tr.status ?? "");
          const nombreChofer = chofer(tr);
          return (
            <button
              key={tr.id}
              type="button"
              onClick={() => onVerEnVivo(tr.id)}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "8px 10px",
                borderRadius: 10,
                background: SURFACE.bg,
                border: `1px solid ${SURFACE.borderMuted}`,
                width: "100%",
                textAlign: "left",
                font: "inherit",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              <div style={{ width: 46, flexShrink: 0, textAlign: "center" }}>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: SURFACE.text,
                    margin: 0,
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1.1,
                  }}
                >
                  {horaEvento(tr.scheduledAt)}
                </p>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    background: st.bg,
                    color: st.color,
                    marginBottom: 3,
                  }}
                >
                  {t(st.label)}
                </span>
                {legTypeShort(tr.legType) && (
                  <span style={{ ...{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: SURFACE.borderMuted, color: SURFACE.textSecondary }, marginBottom: 3, marginLeft: 4 }}>
                    {t(legTypeShort(tr.legType))}
                  </span>
                )}
                <p
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: SURFACE.text,
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {origen(tr)} → {destino(tr)}
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                  {(nombreChofer || tr.vehiclePlate) && (
                    <span style={{ fontSize: 11, color: SURFACE.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CarIcon size={11} /> {nombreChofer ?? t("Sin chofer")}
                      {tr.vehiclePlate ? ` · ${tr.vehiclePlate}` : ""}
                    </span>
                  )}
                  {(tr.passengerCount || (tr.athleteIds ?? []).length > 0) && (
                    <span style={{ fontSize: 11, color: SURFACE.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <UsersIcon size={11} /> {tr.passengerCount ?? (tr.athleteIds ?? []).length} {t("personas")}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ display: "flex", color: SURFACE.textFaint, flexShrink: 0 }}>
                <ChevronRightIcon size={16} strokeWidth={2.2} />
              </span>
            </button>
          );
        })}

        {resto > 0 && (
          <p style={{ fontSize: 11.5, color: SURFACE.textFaint, textAlign: "center", margin: 0 }}>
            {`${t("y")} ${resto} ${resto === 1 ? t("más en ruta") : t("más en ruta")}`}
          </p>
        )}
      </div>
    </div>
  );
}
