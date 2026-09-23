"use client";

import { useEffect, useMemo, useState } from "react";
import DriverPresenceMap, { type PresenceMarker } from "@/components/DriverPresenceMap";
import { RefreshIcon, WhatsappIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { openExternal, whatsappHref } from "@/lib/external-link";
import { useI18n } from "@/lib/i18n";
import { claveDiaEvento, fechaHoraEvento, horaEvento, horaSegundosEvento } from "@/lib/hora-evento";
import { mapaDeLugares } from "@/lib/lugares";
import type { MissionTrip } from "@/components/portal/MissionTrips";

/**
 * Flota de la delegación para el Jefe de Misión: qué viajes van en curso ahora,
 * dónde está cada chofer en el mapa y cómo contactarlo.
 *
 * El alcance lo aplica el backend: entran los choferes asignados a su región y
 * los que conducen viajes de su delegación, porque en la operación diaria el
 * chofer se asigna viaje a viaje.
 */
type PresenceDriver = {
  driverId: string;
  fullName: string;
  phone: string | null;
  online: boolean;
  secondsSinceSeen: number | null;
  activeTrips: number;
  dayTripCount: number;
  activeTripId: string | null;
  activeTripStatus: string | null;
  gpsAgeSeconds: number | null;
  lat: number | null;
  lng: number | null;
  gpsTimestamp: string | null;
  platform: string | null;
};

type Snapshot = {
  ts: string;
  stats: { totalDrivers: number; onlineNow: number; driversToday: number };
  drivers: PresenceDriver[];
};

type NamedPlace = { id: string; name?: string | null; venueType?: string | null };

const REFRESH_MS = 10_000;
// Un chofer "en línea" transmite hace menos de un minuto; su marcador se
// conserva hasta 10 minutos después del último fix.
const LIVE_WINDOW_S = 60;
const SHOW_WINDOW_S = 10 * 60;
const EN_CURSO = new Set(["EN_ROUTE", "PICKED_UP"]);

function ago(seconds: number | null, t: (s: string) => string): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${t("hace")} ${seconds}s`;
  if (seconds < 3600) return `${t("hace")} ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${t("hace")} ${Math.floor(seconds / 3600)} h`;
  return `${t("hace")} ${Math.floor(seconds / 86400)} d`;
}

function tripLabel(status: string | null, activeTrips: number): string | null {
  if (status === "EN_ROUTE") return "Va en camino";
  if (status === "PICKED_UP") return "Pasajero a bordo";
  if (activeTrips > 0) return "En viaje";
  return null;
}

export default function MissionFleet({
  eventId,
  delegationName,
  trips,
  venues,
  accommodations,
  comedores = [],
  focoTripId = null,
}: {
  eventId?: string | null;
  delegationName: string;
  /** Viajes de la delegación, ya acotados por el backend. */
  trips: MissionTrip[];
  venues: NamedPlace[];
  accommodations: NamedPlace[];
  /** Comedores de Alimentación: el viaje puede apuntar a ellos por id. */
  comedores?: NamedPlace[];
  /**
   * Traslado que se vino a mirar, elegido en el banner "Ahora mismo". El mapa
   * se centra en su chofer y su ficha queda destacada y la primera.
   */
  focoTripId?: string | null;
}) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setRefreshing(true);
      try {
        const q = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
        const data = await apiFetch<Snapshot>(`/driver-presence/snapshot${q}`);
        if (!alive) return;
        setSnapshot(data);
        setError(null);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : t("No se pudo cargar la flota."));
      } finally {
        if (alive) setRefreshing(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [eventId, t]);

  // Nombre del recinto, para no mostrar direcciones largas.
  // "Comedor LRH (ex Gala)", "Sede Elías Figueroa", "Hotel Mahía".
  const lugar = useMemo(() => mapaDeLugares(venues, accommodations, comedores), [venues, accommodations, comedores]);
  const punto = (tr: MissionTrip, extremo: "origin" | "destination") => {
    const id = extremo === "origin" ? (tr.originVenueId ?? tr.originHotelId) : (tr.destinationVenueId ?? tr.destinationHotelId);
    return (id ? lugar.get(id) : null) ?? (extremo === "origin" ? tr.origin : tr.destination) ?? "—";
  };

  const focoDriverIdBase = useMemo(
    () => (focoTripId ? trips.find((tr) => tr.id === focoTripId)?.driverId ?? null : null),
    [focoTripId, trips],
  );

  const drivers = useMemo(() => {
    const list = snapshot?.drivers ?? [];
    const foco = focoDriverIdBase ?? list.find((d) => d.activeTripId === focoTripId)?.driverId ?? null;
    return [...list].sort((a, b) => {
      // El chofer que se vino a mirar, primero de todos.
      if (foco) {
        if (a.driverId === foco) return -1;
        if (b.driverId === foco) return 1;
      }
      const ra = a.activeTrips > 0 ? 0 : a.online ? 1 : 2;
      const rb = b.activeTrips > 0 ? 0 : b.online ? 1 : 2;
      return ra - rb || a.fullName.localeCompare(b.fullName);
    });
  }, [snapshot, focoDriverIdBase, focoTripId]);

  const nombreChofer = (driverId?: string | null) =>
    driverId ? drivers.find((d) => d.driverId === driverId)?.fullName ?? null : null;

  // Viajes en curso y los de hoy, para los indicadores de arriba. "Hoy" es
  // el día del evento, no el del aparato.
  const hoyKey = claveDiaEvento(new Date());
  const enCurso = useMemo(() => trips.filter((tr) => EN_CURSO.has(String(tr.status ?? "").toUpperCase())), [trips]);
  const deHoy = useMemo(
    () => trips.filter((tr) => tr.scheduledAt && claveDiaEvento(tr.scheduledAt) === hoyKey),
    [trips, hoyKey],
  );

  const markers = useMemo<PresenceMarker[]>(
    () =>
      drivers
        .filter((d) => d.lat != null && d.lng != null && d.gpsAgeSeconds != null && d.gpsAgeSeconds <= SHOW_WINDOW_S)
        .map((d) => {
          const reporting = (d.gpsAgeSeconds ?? Infinity) < LIVE_WINDOW_S;
          const label = tripLabel(d.activeTripStatus, d.activeTrips);
          // Si va en un viaje de la delegación, el popup dice cuál.
          const viaje = d.activeTripId ? trips.find((tr) => tr.id === d.activeTripId) : undefined;
          return {
            id: d.driverId,
            lat: d.lat as number,
            lng: d.lng as number,
            name: d.fullName,
            online: reporting,
            onTrip: reporting && d.activeTrips > 0,
            tripLabel: label ? t(label) : null,
            lastSeen: ago(d.secondsSinceSeen, t),
            gpsTime: fechaHoraEvento(d.gpsTimestamp),
            activeTrips: d.activeTrips,
            platform: d.platform,
            clientTypes: [],
            detailRows: viaje
              ? [{ label: t("Viaje"), value: `${punto(viaje, "origin")} → ${punto(viaje, "destination")}` }]
              : undefined,
          };
        }),
    [drivers, trips, t, lugar],
  );

  const kpi = (label: string, value: number, color: string) => (
    <div style={{ flex: 1, background: SURFACE.card, borderRadius: 12, border: `1px solid ${SURFACE.border}`, padding: "10px 12px" }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: SURFACE.textMuted, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color, margin: "2px 0 0", lineHeight: 1.1 }}>{value}</p>
    </div>
  );

  // Chofer del traslado que se vino a mirar: el mapa se centra en él y su
  // ficha sube al principio de la lista.
  const focoDriverId = useMemo(() => {
    if (!focoTripId) return null;
    if (focoDriverIdBase) return focoDriverIdBase;
    return snapshot?.drivers.find((d) => d.activeTripId === focoTripId)?.driverId ?? null;
  }, [focoTripId, focoDriverIdBase, snapshot]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, padding: 14, borderLeft: `4px solid ${BRAND.teal}` }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, margin: "0 0 6px" }}>{t("Flota de mi delegación")}</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{delegationName || "—"}</p>
        <p style={{ fontSize: 11.5, color: SURFACE.textMuted, margin: "3px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshIcon size={11} style={refreshing ? { animation: "spin 1s linear infinite" } : undefined} />
          {snapshot ? `${t("Actualizado")} ${horaSegundosEvento(snapshot.ts)}` : t("Cargando…")}
        </p>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 12, background: STATE.dangerSoft, color: STATE.dangerText, border: `1px solid ${STATE.dangerBorder}`, fontSize: 12.5 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {kpi(t("En curso"), enCurso.length, BRAND.tealInk)}
        {kpi(t("Viajes hoy"), deHoy.length, SURFACE.text)}
        {kpi(t("Conductores en línea"), snapshot?.stats.onlineNow ?? 0, STATE.successText)}
      </div>

      {/* Mapa en vivo: los choferes que están transmitiendo ahora. */}
      {markers.length > 0 ? (
        <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${SURFACE.border}` }}>
          <DriverPresenceMap markers={markers} height={260} focoId={focoDriverId} />
        </div>
      ) : (
        <div style={{ padding: 16, textAlign: "center", background: SURFACE.card, borderRadius: 14, border: `1px dashed ${SURFACE.border}` }}>
          <p style={{ fontSize: 12.5, color: SURFACE.textFaint, margin: 0 }}>{t("Ningún chofer de tu delegación está transmitiendo su posición ahora.")}</p>
        </div>
      )}

      {/* Viajes en curso */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: BRAND.teal, margin: "4px 0 0" }}>
        {t("Viajes en curso")}
      </p>
      {enCurso.length === 0 ? (
        <div style={{ padding: 14, textAlign: "center", background: SURFACE.card, borderRadius: 12, border: `1px solid ${SURFACE.border}` }}>
          <p style={{ fontSize: 12.5, color: SURFACE.textFaint, margin: 0 }}>{t("Ningún viaje de tu delegación está en ruta en este momento.")}</p>
        </div>
      ) : (
        enCurso.map((tr) => {
          const estado = String(tr.status ?? "").toUpperCase() === "PICKED_UP" ? t("Pasajero a bordo") : t("Va en camino");
          return (
            <div key={tr.id} style={{ background: SURFACE.card, borderRadius: 12, border: `1px solid ${SURFACE.border}`, borderLeft: `3px solid ${STATE.success}`, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: STATE.successSoft, color: STATE.successText }}>{estado}</span>
                <span style={{ fontSize: 11.5, color: SURFACE.textMuted }}>{horaEvento(tr.scheduledAt)}</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text, margin: "4px 0 0" }}>
                {punto(tr, "origin")} → {punto(tr, "destination")}
              </p>
              <p style={{ fontSize: 11.5, color: SURFACE.textMuted, margin: "2px 0 0" }}>
                {nombreChofer(tr.driverId) ?? t("Sin chofer")}
                {tr.vehiclePlate ? ` · ${tr.vehiclePlate}` : ""}
              </p>
            </div>
          );
        })
      )}

      {/* Conductores */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: BRAND.teal, margin: "6px 0 0" }}>
        {t("Conductores")}
      </p>
      {drivers.length === 0 && !error && (
        <div style={{ padding: 16, textAlign: "center", background: SURFACE.card, borderRadius: 12, border: `1px solid ${SURFACE.border}` }}>
          <p style={{ fontSize: 12.5, color: SURFACE.textFaint, margin: 0 }}>
            {t("Aún no hay conductores asignados a los viajes de tu delegación.")}
          </p>
        </div>
      )}

      {drivers.map((d) => {
        const label = tripLabel(d.activeTripStatus, d.activeTrips);
        const tone = d.activeTrips > 0
          ? { bg: STATE.successSoft, fg: STATE.successText, border: STATE.successBorder, text: label ? t(label) : t("En viaje") }
          : d.online
            ? { bg: STATE.infoSoft, fg: STATE.infoText, border: STATE.infoBorder, text: t("En línea") }
            : { bg: SURFACE.borderMuted, fg: SURFACE.textMuted, border: SURFACE.border, text: t("Sin señal") };
        return (
          <div key={d.driverId} style={{ background: SURFACE.card, borderRadius: 12, border: `1px solid ${d.driverId === focoDriverId ? BRAND.teal : SURFACE.border}`, boxShadow: d.driverId === focoDriverId ? "0 0 0 3px rgba(33,208,179,0.18)" : "none", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{d.fullName}</p>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {tone.text}
                </span>
              </div>
              <p style={{ fontSize: 11, color: SURFACE.textMuted, margin: "4px 0 0" }}>
                {t("Última señal")}: {ago(d.secondsSinceSeen, t)} · {t("Viajes hoy")}: {d.dayTripCount}
              </p>
            </div>
            {d.phone && (
              <button
                type="button"
                title={t("WhatsApp")}
                onClick={() => openExternal(whatsappHref(d.phone as string))}
                style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${SURFACE.border}`, background: SURFACE.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: BRAND.tealInk, flexShrink: 0 }}
              >
                <WhatsappIcon size={16} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
