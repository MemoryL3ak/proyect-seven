"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { downloadCSV } from "@/lib/export";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import EmptyStateBox from "@/components/ui/EmptyState";
import {
  TruckIcon,
  UsersIcon,
  CheckIcon,
  RefreshIcon,
  UploadIcon,
} from "@/components/ui/Icons";
import type { PresenceMarker } from "@/components/DriverPresenceMap";

const DriverPresenceMap = dynamic(() => import("@/components/DriverPresenceMap"), {
  ssr: false,
});

type PresenceDriver = {
  driverId: string;
  fullName: string;
  driverStatus: string | null;
  online: boolean;
  sessionStartedAt: string | null;
  lastSeenAt: string | null;
  secondsSinceSeen: number | null;
  heartbeats: number | null;
  platform: string | null;
  appVersion: string | null;
  activeTrips: number;
  // The driver's active trip (heading to pickup or passenger aboard), if any.
  activeTripId: string | null;
  activeTripStatus: string | null;
  gpsAgeSeconds: number | null;
  lat: number | null;
  lng: number | null;
  gpsTimestamp: string | null;
};

// Turns a trip status into the label shown on the map/list. Falls back to a
// generic "En viaje" when we only know the driver has an active trip.
function tripLabel(status: string | null, activeTrips: number): string | null {
  if (status === "EN_ROUTE") return "Va en camino";
  if (status === "PICKED_UP") return "Pasajero a bordo";
  if (activeTrips > 0) return "En viaje";
  return null;
}

type Snapshot = {
  ts: string;
  stats: { totalDrivers: number; onlineNow: number; driversToday: number; sessionsToday: number };
  drivers: PresenceDriver[];
};

type PositionItem = {
  id: string;
  vehicleId?: string;
  driverId?: string;
  timestamp: string;
  // Server wall-clock when persisted. Preferred over `timestamp` for
  // freshness decisions — device clocks can be skewed.
  createdAt?: string;
  location?: { coordinates?: [number, number] } | { lat?: number; lng?: number };
};

type LivePosition = {
  lat: number;
  lng: number;
  timestamp: string; // device clock (shown as "GPS hh:mm")
  receivedAt: string; // server clock (drives freshness)
};

// A driver counts as "reporting live" (green) when their freshest fix is under
// this old. Beyond it, the marker stays on the map but greys out.
const LIVE_WINDOW_MS = 30 * 1000;
// Keep showing a driver's marker until their last fix is this stale.
const SHOW_WINDOW_MS = 10 * 60 * 1000;

function pickCoords(pos: PositionItem): { lat: number; lng: number } | null {
  const loc = pos.location as any;
  const coords = loc?.coordinates;
  const lat = coords ? coords[1] : loc?.lat;
  const lng = coords ? coords[0] : loc?.lng;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function ago(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `hace ${seconds}s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
  return `hace ${Math.floor(seconds / 86400)} d`;
}

export default function DriverMonitoringPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Freshest live position per driver, fed by Supabase Realtime + a fast poll.
  // These override the (slower, DB-join) coordinates from the presence snapshot
  // so the map moves in real time.
  const [livePositions, setLivePositions] = useState<Record<string, LivePosition>>({});
  // Re-evaluates freshness windows every second so a driver who stops sending
  // greys out within ~1s of crossing the threshold.
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Merges a fresh fix in only when it's newer (by server clock) than what we
  // already hold for that driver — protects against out-of-order delivery.
  const mergePosition = useCallback((driverId: string, next: LivePosition) => {
    setLivePositions((prev) => {
      const current = prev[driverId];
      if (current && new Date(next.receivedAt) <= new Date(current.receivedAt)) return prev;
      return { ...prev, [driverId]: next };
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Snapshot>("/driver-presence/snapshot");
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el monitoreo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  // Live GPS layer: Supabase Realtime pushes every new position the instant it
  // lands; a fast poll backs it up where Realtime isn't connected. This is the
  // same mechanism the trip-tracking module uses, applied here to ALL drivers.
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel("driver-monitoring-positions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "telemetry", table: "vehicle_positions" },
        (payload) => {
          const row = payload.new as {
            driver_id: string;
            vehicle_id: string | null;
            timestamp: string;
            created_at: string;
            location?: unknown;
            lat?: number | null;
            lng?: number | null;
          };
          let lat: number | null = row.lat ?? null;
          let lng: number | null = row.lng ?? null;
          if ((lat == null || lng == null) && row.location && typeof row.location === "object") {
            const coords = (row.location as { coordinates?: [number, number] }).coordinates;
            if (coords && Array.isArray(coords)) {
              lng = coords[0];
              lat = coords[1];
            }
          }
          const driverId = row.driver_id;
          if (lat == null || lng == null || !driverId) return;
          mergePosition(driverId, {
            lat,
            lng,
            timestamp: row.timestamp,
            receivedAt: row.created_at || row.timestamp,
          });
        },
      )
      .subscribe();

    // Fast position-only poll — backup for when Realtime isn't connected and a
    // snappier feel. Cheap: /vehicle-positions returns small rows.
    const positionsTimer = setInterval(async () => {
      try {
        const data = await apiFetch<PositionItem[]>("/vehicle-positions");
        (data || []).forEach((pos) => {
          const driverId = pos.driverId;
          if (!driverId) return;
          const c = pickCoords(pos);
          if (!c) return;
          mergePosition(driverId, {
            lat: c.lat,
            lng: c.lng,
            timestamp: pos.timestamp,
            receivedAt: pos.createdAt || pos.timestamp,
          });
        });
      } catch {
        // ignore — next tick retries.
      }
    }, 2500);

    const tickTimer = setInterval(() => setNowTick(Date.now()), 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(positionsTimer);
      clearInterval(tickTimer);
    };
  }, [mergePosition]);

  const stats = snapshot?.stats ?? { totalDrivers: 0, onlineNow: 0, driversToday: 0, sessionsToday: 0 };
  const drivers = snapshot?.drivers ?? [];

  const markers = useMemo<PresenceMarker[]>(
    () =>
      drivers
        .map((d) => {
          // Prefer the freshest live fix; fall back to the snapshot's DB-join
          // coordinates so a driver still appears right after page load, before
          // the first realtime push arrives.
          const live = livePositions[d.driverId];
          let lat: number | null = null;
          let lng: number | null = null;
          let gpsTimestamp: string | null = null;
          let ageMs = Infinity;
          if (live) {
            lat = live.lat;
            lng = live.lng;
            gpsTimestamp = live.timestamp;
            ageMs = nowTick - new Date(live.receivedAt).getTime();
          } else if (d.lat != null && d.lng != null) {
            lat = d.lat;
            lng = d.lng;
            gpsTimestamp = d.gpsTimestamp;
            ageMs = d.gpsAgeSeconds != null ? d.gpsAgeSeconds * 1000 : Infinity;
          }
          if (lat == null || lng == null || ageMs > SHOW_WINDOW_MS) return null;
          // Reporting = actively sending right now; grey = has a recent-ish last
          // known spot but isn't currently transmitting.
          const reporting = ageMs < LIVE_WINDOW_MS;
          // "En viaje" (green) only when live AND on an active trip, so a green
          // pin always means a driver we're tracking in real time.
          const onTrip = reporting && d.activeTrips > 0;
          return {
            id: d.driverId,
            lat,
            lng,
            name: d.fullName,
            online: reporting,
            onTrip,
            tripLabel: tripLabel(d.activeTripStatus, d.activeTrips),
            lastSeen: ago(d.secondsSinceSeen),
            gpsTime:
              gpsTimestamp != null
                ? new Date(gpsTimestamp).toLocaleString("es-CL", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—",
            activeTrips: d.activeTrips,
            platform: d.platform,
          } as PresenceMarker;
        })
        .filter((m): m is PresenceMarker => m !== null),
    [drivers, livePositions, nowTick],
  );

  // Drivers on an active trip float to the top of the list so operators see
  // who's actually rolling first. Stable otherwise (backend order preserved).
  const sortedDrivers = useMemo(
    () =>
      [...drivers].sort(
        (a, b) => (b.activeTrips > 0 ? 1 : 0) - (a.activeTrips > 0 ? 1 : 0),
      ),
    [drivers],
  );
  const onTripCount = useMemo(
    () => drivers.filter((d) => d.activeTrips > 0).length,
    [drivers],
  );

  const exportCsv = () => {
    if (drivers.length === 0) return;
    downloadCSV(
      `monitoreo-conductores-${new Date().toISOString().slice(0, 10)}`,
      drivers.map((d) => ({
        conductor: d.fullName,
        estado: d.online ? "Conectado" : "Desconectado",
        ultima_conexion: d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString("es-CL") : "Nunca",
        inicio_sesion: d.sessionStartedAt ? new Date(d.sessionStartedAt).toLocaleString("es-CL") : "—",
        latidos: d.heartbeats ?? 0,
        plataforma: d.platform ?? "—",
        viajes_activos: d.activeTrips,
        gps: d.gpsAgeSeconds == null ? "sin señal" : `hace ${Math.round(d.gpsAgeSeconds / 60)} min`,
      })),
    );
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title="Monitoreo de Conductores"
        description="Seguimiento en vivo de los conductores que tienen la aplicación abierta, hayan iniciado un viaje o no. Detecta presencia, sesiones y actividad de la app."
        icon={<TruckIcon size={24} />}
        meta={
          <span
            className="inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1"
            style={{ background: "#e7f5ec", color: "#1eb19a" }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#21D0B3",
                boxShadow: "0 0 0 3px rgba(33,208,179,0.25)",
              }}
            />
            En vivo · ubicaciones en tiempo real
          </span>
        }
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={drivers.length === 0}
            className="btn btn-ghost"
          >
            <UploadIcon size={15} className="inline-block mr-1.5 -mt-0.5" />
            Exportar CSV
          </button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Conectados ahora"
          value={stats.onlineNow}
          detail="con la app abierta"
          icon={<UsersIcon size={18} />}
          accent={stats.onlineNow > 0 ? "green" : "neutral"}
        />
        <KpiCard
          label="Conductores totales"
          value={stats.totalDrivers}
          detail="registrados en el evento"
          icon={<TruckIcon size={18} />}
          accent="blue"
        />
        <KpiCard
          label="Activos hoy"
          value={stats.driversToday}
          detail="abrieron la app hoy"
          icon={<CheckIcon size={18} />}
          accent="purple"
        />
        <KpiCard
          label="Sesiones hoy"
          value={stats.sessionsToday}
          detail="aperturas de la app"
          icon={<RefreshIcon size={18} />}
          accent="amber"
        />
      </section>

      {error && (
        <section
          className="surface rounded-2xl p-4"
          style={{ borderLeft: "4px solid #b3231b", backgroundColor: "#fde2e2" }}
        >
          <p className="text-sm" style={{ color: "#7a1313" }}>{error}</p>
        </section>
      )}

      {drivers.length > 0 && (
        <section className="surface rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Mapa de conductores
            </h2>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {markers.length} con señal GPS
              {onTripCount > 0 && (
                <>
                  {" · "}
                  <span style={{ color: "#059669", fontWeight: 700 }}>
                    {onTripCount} en viaje
                  </span>
                </>
              )}
            </span>
          </div>
          {markers.length === 0 ? (
            <div
              className="rounded-xl flex items-center justify-center text-center px-4"
              style={{ height: 280, background: "#f1f5f9" }}
            >
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Ningún conductor tiene una posición GPS registrada todavía.
                <br />
                El mapa se poblará cuando la app de un conductor reporte su ubicación.
              </p>
            </div>
          ) : (
            <DriverPresenceMap markers={markers} height={420} />
          )}
        </section>
      )}

      {loading && !snapshot ? (
        <section className="surface rounded-2xl p-8">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando monitoreo…</p>
        </section>
      ) : drivers.length === 0 ? (
        <EmptyStateBox
          icon={<TruckIcon size={36} />}
          title="No hay conductores registrados"
          description="Cuando un conductor abra el Portal Conductor, su sesión aparecerá acá en tiempo real, haya iniciado un viaje o no."
        />
      ) : (
        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ backgroundColor: "#1f4e8c", color: "#fff" }}>
                <tr>
                  <th className="p-3 text-left">Conductor</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-left">Última conexión</th>
                  <th className="p-3 text-left">Sesión</th>
                  <th className="p-3 text-left">Viajes activos</th>
                  <th className="p-3 text-left">GPS</th>
                </tr>
              </thead>
              <tbody>
                {sortedDrivers.map((d, i) => {
                  // Same freshness source as the map: a live fix (realtime/poll)
                  // if we have one, otherwise the snapshot's GPS age.
                  const live = livePositions[d.driverId];
                  const gpsAgeMs = live
                    ? nowTick - new Date(live.receivedAt).getTime()
                    : d.gpsAgeSeconds != null
                      ? d.gpsAgeSeconds * 1000
                      : Infinity;
                  const gpsActive = gpsAgeMs < LIVE_WINDOW_MS;
                  const onTrip = d.activeTrips > 0;
                  const tripText = tripLabel(d.activeTripStatus, d.activeTrips);
                  return (
                    <tr key={d.driverId} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-3 font-medium whitespace-nowrap">{d.fullName}</td>
                      <td className="p-3 whitespace-nowrap">
                        {onTrip ? (
                          <span
                            className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: "#dcfce7", color: "#059669" }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                marginRight: 5,
                                background: "#10b981",
                              }}
                            />
                            {tripText ?? "En viaje"}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={
                              d.online
                                ? { backgroundColor: "#e3edfa", color: "#1f4e8c" }
                                : { backgroundColor: "#eef1f6", color: "#5e6b7a" }
                            }
                          >
                            <span
                              style={{
                                display: "inline-block",
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                marginRight: 5,
                                background: d.online ? "#2563eb" : "#94a3b8",
                              }}
                            />
                            {d.online ? "En línea" : "Desconectado"}
                          </span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {ago(d.secondsSinceSeen)}
                      </td>
                      <td className="p-3 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {d.sessionStartedAt ? (
                          <>
                            {new Date(d.sessionStartedAt).toLocaleTimeString("es-CL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            <span> · {d.heartbeats ?? 0} latidos</span>
                            {d.platform && <span> · {d.platform}</span>}
                          </>
                        ) : (
                          "Nunca usó la app"
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {onTrip ? (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: "#dcfce7", color: "#059669" }}
                          >
                            {tripText ?? "En viaje"}
                            {d.activeTrips > 1 ? ` · ${d.activeTrips}` : ""}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span style={{ color: gpsActive ? "#2e7d32" : "#94a3b8", fontWeight: 600 }}>
                          {gpsActive ? "● Reportando" : "○ Sin señal"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
