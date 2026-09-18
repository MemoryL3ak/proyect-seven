"use client";

import { useEffect, useMemo, useState } from "react";
import DriverPresenceMap, { type PresenceMarker } from "@/components/DriverPresenceMap";
import { MessageIcon, RefreshIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { openExternal, whatsappHref } from "@/lib/external-link";

/**
 * Monitoreo de flota para el Jefe de Misión (portal). El backend ya acota el
 * snapshot a la flota fija de su delegación (StaffScopeService), así que acá
 * sólo se muestra: KPIs, mapa con las últimas posiciones y la lista de
 * choferes con su estado. Se refresca cada 10 s mientras la pestaña está abierta.
 */
type PresenceDriver = {
  driverId: string;
  fullName: string;
  phone: string | null;
  online: boolean;
  secondsSinceSeen: number | null;
  activeTrips: number;
  dayTripCount: number;
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

const REFRESH_MS = 10_000;
// Un chofer "en línea" transmite hace menos de un minuto; su marcador se
// conserva hasta 10 minutos después del último fix.
const LIVE_WINDOW_S = 60;
const SHOW_WINDOW_S = 10 * 60;

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

export default function MissionFleet({ eventId, delegationName }: { eventId?: string | null; delegationName: string }) {
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

  const drivers = useMemo(() => {
    const list = snapshot?.drivers ?? [];
    // Primero los que van en viaje, luego los conectados, luego el resto.
    return [...list].sort((a, b) => {
      const ra = (a.activeTrips > 0 ? 0 : a.online ? 1 : 2);
      const rb = (b.activeTrips > 0 ? 0 : b.online ? 1 : 2);
      return ra - rb || a.fullName.localeCompare(b.fullName);
    });
  }, [snapshot]);

  const markers = useMemo<PresenceMarker[]>(
    () =>
      drivers
        .filter((d) => d.lat != null && d.lng != null && d.gpsAgeSeconds != null && d.gpsAgeSeconds <= SHOW_WINDOW_S)
        .map((d) => {
          const reporting = (d.gpsAgeSeconds ?? Infinity) < LIVE_WINDOW_S;
          const label = tripLabel(d.activeTripStatus, d.activeTrips);
          return {
            id: d.driverId,
            lat: d.lat as number,
            lng: d.lng as number,
            name: d.fullName,
            online: reporting,
            onTrip: reporting && d.activeTrips > 0,
            tripLabel: label ? t(label) : null,
            lastSeen: ago(d.secondsSinceSeen, t),
            gpsTime: d.gpsTimestamp
              ? new Date(d.gpsTimestamp).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
              : "—",
            activeTrips: d.activeTrips,
            platform: d.platform,
            clientTypes: [],
          };
        }),
    [drivers, t],
  );

  const onTrip = drivers.filter((d) => d.activeTrips > 0).length;
  const kpi = (label: string, value: number, color: string) => (
    <div style={{ flex: 1, background: SURFACE.card, borderRadius: 12, border: `1px solid ${SURFACE.border}`, padding: "10px 12px" }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: SURFACE.textMuted, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color, margin: "2px 0 0", lineHeight: 1.1 }}>{value}</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, padding: 14, borderLeft: `4px solid ${BRAND.teal}` }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, margin: "0 0 6px" }}>{t("Flota de mi delegación")}</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{delegationName || "—"}</p>
        <p style={{ fontSize: 11.5, color: SURFACE.textMuted, margin: "3px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshIcon size={11} style={refreshing ? { animation: "spin 1s linear infinite" } : undefined} />
          {snapshot ? `${t("Actualizado")} ${new Date(snapshot.ts).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : t("Cargando…")}
        </p>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 12, background: STATE.dangerSoft, color: STATE.dangerText, border: `1px solid ${STATE.dangerBorder}`, fontSize: 12.5 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {kpi(t("Choferes"), snapshot?.stats.totalDrivers ?? 0, SURFACE.text)}
        {kpi(t("En línea"), snapshot?.stats.onlineNow ?? 0, STATE.successText)}
        {kpi(t("En viaje"), onTrip, BRAND.tealInk)}
      </div>

      {markers.length > 0 ? (
        <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${SURFACE.border}` }}>
          <DriverPresenceMap markers={markers} height={260} />
        </div>
      ) : (
        <div style={{ padding: 16, textAlign: "center", background: SURFACE.card, borderRadius: 14, border: `1px dashed ${SURFACE.border}` }}>
          <p style={{ fontSize: 12.5, color: SURFACE.textFaint, margin: 0 }}>{t("Ningún chofer de tu delegación está transmitiendo su posición ahora.")}</p>
        </div>
      )}

      {drivers.length === 0 && !error && (
        <div style={{ padding: 20, textAlign: "center", background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}` }}>
          <p style={{ fontSize: 13, color: SURFACE.textFaint, margin: 0 }}>{t("Tu delegación aún no tiene choferes asignados. Operaciones los asigna en el maestro de Delegaciones.")}</p>
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
          <div key={d.driverId} style={{ background: SURFACE.card, borderRadius: 12, border: `1px solid ${SURFACE.border}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
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
                <MessageIcon size={16} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
