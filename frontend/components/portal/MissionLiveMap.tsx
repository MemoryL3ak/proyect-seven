"use client";

import { useEffect, useMemo, useState } from "react";
import DriverPresenceMap, { type PresenceMarker } from "@/components/DriverPresenceMap";
import { apiFetch } from "@/lib/api";
import { fechaHoraEvento } from "@/lib/hora-evento";
import { SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { mapaDeLugares } from "@/lib/lugares";
import type { MissionTrip } from "@/components/portal/MissionTrips";

/**
 * Mapa en vivo de los buses de la delegación, para verlo SIN salir de
 * Actividades. Antes había un botón que mandaba al módulo Flota, y lo que se
 * quiere al ver un bus en ruta es el mapa ahí mismo.
 */
type PresenceDriver = {
  driverId: string;
  fullName: string;
  online: boolean;
  secondsSinceSeen: number | null;
  activeTrips: number;
  activeTripId: string | null;
  activeTripStatus: string | null;
  gpsAgeSeconds: number | null;
  lat: number | null;
  lng: number | null;
  gpsTimestamp: string | null;
  platform: string | null;
};
type Snapshot = { ts: string; drivers: PresenceDriver[] };
type NamedPlace = { id: string; name?: string | null; venueType?: string | null };

const REFRESH_MS = 10_000;
/** Transmitiendo hace menos de un minuto. */
const LIVE_WINDOW_S = 60;
/** El marcador se conserva hasta diez minutos después del último punto. */
const SHOW_WINDOW_S = 10 * 60;

function hace(segundos: number | null, t: (s: string) => string): string {
  if (segundos == null) return "—";
  if (segundos < 60) return `${t("hace")} ${segundos}s`;
  if (segundos < 3600) return `${t("hace")} ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `${t("hace")} ${Math.floor(segundos / 3600)} h`;
  return `${t("hace")} ${Math.floor(segundos / 86400)} d`;
}

export default function MissionLiveMap({
  eventId,
  trips,
  focoTripId,
  venues,
  accommodations,
  height = 230,
}: {
  eventId?: string | null;
  trips: MissionTrip[];
  /** Bus que se vino a mirar: el mapa se centra en él. */
  focoTripId?: string | null;
  venues: NamedPlace[];
  accommodations: NamedPlace[];
  height?: number;
}) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const q = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
        const data = await apiFetch<Snapshot>(`/driver-presence/snapshot${q}`);
        if (!vivo) return;
        setSnapshot(data);
        setFallo(false);
      } catch {
        if (vivo) setFallo(true);
      }
    };
    void cargar();
    const timer = setInterval(() => void cargar(), REFRESH_MS);
    return () => {
      vivo = false;
      clearInterval(timer);
    };
  }, [eventId]);

  const lugar = useMemo(() => mapaDeLugares(venues, accommodations), [venues, accommodations]);
  const punto = (tr: MissionTrip, extremo: "origin" | "destination") => {
    const id = extremo === "origin" ? (tr.originVenueId ?? tr.originHotelId) : (tr.destinationVenueId ?? tr.destinationHotelId);
    return (id ? lugar.get(id) : null) ?? (extremo === "origin" ? tr.origin : tr.destination) ?? "—";
  };

  const markers = useMemo<PresenceMarker[]>(
    () =>
      (snapshot?.drivers ?? [])
        .filter((d) => d.lat != null && d.lng != null && d.gpsAgeSeconds != null && d.gpsAgeSeconds <= SHOW_WINDOW_S)
        .map((d) => {
          const transmitiendo = (d.gpsAgeSeconds ?? Infinity) < LIVE_WINDOW_S;
          const viaje = d.activeTripId ? trips.find((tr) => tr.id === d.activeTripId) : undefined;
          return {
            id: d.driverId,
            lat: d.lat as number,
            lng: d.lng as number,
            name: d.fullName,
            online: transmitiendo,
            onTrip: transmitiendo && d.activeTrips > 0,
            tripLabel: d.activeTripStatus === "PICKED_UP" ? t("Pasajero a bordo") : d.activeTrips > 0 ? t("Va en camino") : null,
            lastSeen: hace(d.secondsSinceSeen, t),
            gpsTime: fechaHoraEvento(d.gpsTimestamp),
            activeTrips: d.activeTrips,
            platform: d.platform,
            clientTypes: [],
            detailRows: viaje
              ? [{ label: t("Viaje"), value: `${punto(viaje, "origin")} → ${punto(viaje, "destination")}` }]
              : undefined,
          } as PresenceMarker;
        }),
    [snapshot, trips, lugar, t],
  );

  /**
   * Chofer del bus que se vino a mirar. Se prueban las dos vías —el chofer
   * asignado al viaje y el que la flota dice que lo está haciendo— y se toma
   * la que tenga marcador en el mapa: centrar en alguien que no está
   * transmitiendo dejaría el mapa donde estaba, sin explicación.
   */
  const focoDriverId = useMemo(() => {
    if (!focoTripId) return null;
    const candidatos = [
      trips.find((tr) => tr.id === focoTripId)?.driverId ?? null,
      snapshot?.drivers.find((d) => d.activeTripId === focoTripId)?.driverId ?? null,
    ].filter(Boolean) as string[];
    return candidatos.find((id) => markers.some((m) => m.id === id)) ?? null;
  }, [focoTripId, trips, snapshot, markers]);

  if (markers.length === 0) {
    return (
      <div
        style={{
          background: SURFACE.card,
          border: `1px dashed ${SURFACE.border}`,
          borderRadius: 12,
          padding: "22px 16px",
          textAlign: "center",
          fontSize: 12.5,
          color: SURFACE.textFaint,
        }}
      >
        {fallo
          ? t("No se pudo cargar la flota.")
          : snapshot === null
            ? t("Cargando…")
            : t("Ningún chofer de tu delegación está transmitiendo su posición ahora.")}
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${SURFACE.border}` }}>
      <DriverPresenceMap markers={markers} height={height} focoId={focoDriverId} />
    </div>
  );
}
