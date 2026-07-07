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
  /** Viajes asignados al conductor para la fecha consultada. */
  dayTripCount: number;
  // The driver's active trip (heading to pickup or passenger aboard), if any.
  activeTripId: string | null;
  activeTripStatus: string | null;
  gpsAgeSeconds: number | null;
  lat: number | null;
  lng: number | null;
  gpsTimestamp: string | null;
  allowedClientTypes: string[];
  disciplines: string[];
};

function todayChile(): string {
  // Hoy en zona Chile como YYYY-MM-DD
  const fmt = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const d = parts.find(p => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

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

type OccupancyFilter = "" | "BUSY" | "FREE";

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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

const CLIENT_TYPE_META: Record<string, { label: string; bg: string; color: string; border: string }> = {
  VIP: { label: "VIP", bg: "#fef3c7", color: "#7a4a00", border: "#fcd34d" },
  TA: { label: "TA", bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
  PRENSA: { label: "Prensa", bg: "#ede9fe", color: "#5b21b6", border: "#c4b5fd" },
  OFICIAL: { label: "Oficial", bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
  STAFF: { label: "Staff", bg: "#e0f2fe", color: "#075985", border: "#7dd3fc" },
  ATHLETE: { label: "Atleta", bg: "#dcfce7", color: "#166534", border: "#86efac" },
};

function clientTypeChip(type: string) {
  const meta = CLIENT_TYPE_META[type.toUpperCase()] || {
    label: type, bg: "#f1f5f9", color: "#475569", border: "#cbd5e1",
  };
  return meta;
}

export default function DriverMonitoringPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Filters
  const today = useMemo(() => todayChile(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [clientTypeFilter, setClientTypeFilter] = useState<string>("");
  const [occupancyFilter, setOccupancyFilter] = useState<OccupancyFilter>("");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const isToday = selectedDate === today;

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
      const url = `/driver-presence/snapshot?date=${encodeURIComponent(selectedDate)}`;
      const data = await apiFetch<Snapshot>(url);
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el monitoreo.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    setLoading(true);
    load();
    // Polling solo si la fecha es hoy (snapshots de fechas pasadas no cambian)
    if (!isToday) return;
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load, isToday]);

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

  // Distinct values for dropdowns
  const clientTypeOptions = useMemo(() => {
    const set = new Set<string>();
    drivers.forEach((d) => (d.allowedClientTypes || []).forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [drivers]);

  const disciplineOptions = useMemo(() => {
    const set = new Set<string>();
    drivers.forEach((d) => (d.disciplines || []).forEach((dx) => set.add(dx)));
    return Array.from(set).sort();
  }, [drivers]);

  // Apply filters
  const visibleDrivers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return drivers.filter((d) => {
      if (clientTypeFilter && !(d.allowedClientTypes || []).includes(clientTypeFilter)) return false;
      if (disciplineFilter && !(d.disciplines || []).includes(disciplineFilter)) return false;
      if (occupancyFilter === "BUSY" && d.activeTrips === 0) return false;
      if (occupancyFilter === "FREE" && d.activeTrips > 0) return false;
      if (q) {
        const matchesName = d.fullName.toLowerCase().includes(q);
        const matchesPlatform = (d.platform || "").toLowerCase().includes(q);
        if (!matchesName && !matchesPlatform) return false;
      }
      return true;
    });
  }, [drivers, clientTypeFilter, disciplineFilter, occupancyFilter, searchQuery]);

  const markers = useMemo<PresenceMarker[]>(
    () =>
      // Respect the active filters (Ariel's filter bar) while keeping the live
      // GPS layer: prefer the freshest realtime/poll fix, fall back to the
      // snapshot's DB-join coordinates so a driver still appears on load.
      visibleDrivers
        .map((d) => {
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
    [visibleDrivers, livePositions, nowTick],
  );

  const onTripCount = useMemo(
    () => drivers.filter((d) => d.activeTrips > 0).length,
    [drivers],
  );

  const busyCount = useMemo(() => drivers.filter((d) => d.activeTrips > 0).length, [drivers]);
  const freeCount = useMemo(() => drivers.filter((d) => d.activeTrips === 0).length, [drivers]);
  const hasFilters = !!(clientTypeFilter || occupancyFilter || disciplineFilter || searchQuery);
  const clearFilters = () => {
    setClientTypeFilter("");
    setOccupancyFilter("");
    setDisciplineFilter("");
    setSearchQuery("");
  };

  const exportCsv = () => {
    if (visibleDrivers.length === 0) return;
    downloadCSV(
      `monitoreo-conductores-${new Date().toISOString().slice(0, 10)}`,
      visibleDrivers.map((d) => ({
        conductor: d.fullName,
        estado: d.online ? "Conectado" : "Desconectado",
        ocupacion: d.activeTrips > 0 ? "Ocupado" : "Desocupado",
        viajes_del_dia: d.dayTripCount,
        tipo_cliente: (d.allowedClientTypes || []).join(" | "),
        disciplinas: (d.disciplines || []).join(" | "),
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
          isToday ? (
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
                  animation: "pulse 1.8s infinite",
                }}
              />
              En vivo · se actualiza cada 8 s
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1"
              style={{ background: "#fef3c7", color: "#7a4a00" }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#d4a017",
                }}
              />
              Histórico · snapshot del {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-CL", {
                day: "2-digit", month: "short", year: "numeric",
              })}
            </span>
          )
        }
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={visibleDrivers.length === 0}
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

      {/* Filters bar — siempre visible para que se pueda cambiar la fecha aunque no haya drivers */}
      <FiltersBar
        selectedDate={selectedDate}
        setSelectedDate={(d) => { setSelectedDate(d); setDisciplineFilter(""); }}
        today={today}
        isToday={isToday}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        occupancyFilter={occupancyFilter}
        setOccupancyFilter={setOccupancyFilter}
        clientTypeFilter={clientTypeFilter}
        setClientTypeFilter={setClientTypeFilter}
        disciplineFilter={disciplineFilter}
        setDisciplineFilter={setDisciplineFilter}
        clientTypeOptions={clientTypeOptions}
        disciplineOptions={disciplineOptions}
        totalCount={drivers.length}
        busyCount={busyCount}
        freeCount={freeCount}
        visibleCount={visibleDrivers.length}
        hasFilters={hasFilters}
        clearFilters={clearFilters}
      />

      {visibleDrivers.length > 0 && (
        <section
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
          }}
        >
          <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>
              Mapa de conductores
            </h2>
            <span className="text-xs" style={{ color: "#94a3b8" }}>
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
              className="rounded-xl flex items-center justify-center text-center px-4 m-4"
              style={{ height: 280, background: "#f1f5f9" }}
            >
              <p className="text-sm" style={{ color: "#94a3b8" }}>
                Ningún conductor tiene una posición GPS registrada todavía.
                <br />
                El mapa se poblará cuando la app de un conductor reporte su ubicación.
              </p>
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              <DriverPresenceMap markers={markers} height={420} />
            </div>
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
      ) : visibleDrivers.length === 0 ? (
        <section
          className="rounded-2xl p-8 text-center"
          style={{
            background: "#fff",
            border: "1px dashed #e2e8f0",
          }}
        >
          <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔍</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: 0 }}>
            No hay conductores que coincidan con los filtros
          </p>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "6px 0 0" }}>
            Prueba quitar algún filtro o cambiar los criterios de búsqueda.
          </p>
        </section>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
          }}
        >
          {/* Table header bar */}
          <div
            className="flex items-center justify-between p-4"
            style={{ borderBottom: "1px solid #f1f5f9" }}
          >
            <h2
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: "#475569" }}
            >
              Detalle de conductores
            </h2>
            <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500 }}>
              {visibleDrivers.length} {visibleDrivers.length === 1 ? "conductor" : "conductores"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 12.5, borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr
                  style={{
                    background: "linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)",
                    borderBottom: "2px solid #e2e8f0",
                  }}
                >
                  {[
                    "Conductor",
                    "Estado",
                    "Ocupación",
                    isToday ? "Viajes hoy" : "Viajes del día",
                    "Tipo cliente",
                    "Disciplinas",
                    "Última conexión",
                    "Sesión",
                    "GPS",
                  ].map((h) => (
                    <th
                      key={h}
                      className="p-3 text-left"
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#64748b",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleDrivers.map((d, i) => {
                  const gpsActive = d.gpsAgeSeconds != null && d.gpsAgeSeconds < 600;
                  const isBusy = d.activeTrips > 0;
                  const tripText = tripLabel(d.activeTripStatus, d.activeTrips);
                  return (
                    <tr
                      key={d.driverId}
                      style={{
                        borderBottom: i === visibleDrivers.length - 1 ? "none" : "1px solid #f1f5f9",
                        background: i % 2 === 0 ? "#fff" : "#fafbfc",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#f0fdf4";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafbfc";
                      }}
                    >
                      {/* Conductor (avatar + nombre) */}
                      <td className="p-3" style={{ whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              background: d.online
                                ? "linear-gradient(135deg, #21D0B3 0%, #15B09A 100%)"
                                : "linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)",
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              letterSpacing: "0.04em",
                              boxShadow: d.online
                                ? "0 2px 8px rgba(33,208,179,0.35)"
                                : "0 1px 3px rgba(15,23,42,0.1)",
                              flexShrink: 0,
                            }}
                          >
                            {initials(d.fullName)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0, lineHeight: 1.2 }}>
                              {d.fullName}
                            </p>
                            {d.platform && (
                              <p style={{ fontSize: 10.5, color: "#94a3b8", margin: "2px 0 0", textTransform: "capitalize" }}>
                                {d.platform}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Estado conexión */}
                      <td className="p-3" style={{ whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 10.5,
                            padding: "4px 10px",
                            borderRadius: 99,
                            fontWeight: 700,
                            letterSpacing: "0.02em",
                            background: d.online ? "linear-gradient(135deg,#dcfce7,#bbf7d0)" : "#eef1f6",
                            color: d.online ? "#166534" : "#5e6b7a",
                            border: `1px solid ${d.online ? "#86efac" : "#cbd5e1"}`,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: d.online ? "#10b981" : "#94a3b8",
                              animation: d.online ? "pulse 1.8s infinite" : "none",
                            }}
                          />
                          {d.online ? "Conectado" : "Desconectado"}
                        </span>
                      </td>

                      {/* Ocupación */}
                      <td className="p-3" style={{ whiteSpace: "nowrap" }}>
                        {isBusy ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 10.5,
                              padding: "4px 10px",
                              borderRadius: 99,
                              fontWeight: 700,
                              background: "linear-gradient(135deg,#ede9fe,#ddd6fe)",
                              color: "#5b21b6",
                              border: "1px solid #c4b5fd",
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3v-6l2.5-5h11L19 11v6h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>
                            {tripText ?? `${d.activeTrips} ${d.activeTrips === 1 ? "viaje" : "viajes"}`}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 10.5,
                              padding: "4px 10px",
                              borderRadius: 99,
                              fontWeight: 700,
                              background: "#e0f7fa",
                              color: "#0e7490",
                              border: "1px solid #67e8f9",
                            }}
                          >
                            Disponible
                          </span>
                        )}
                      </td>

                      {/* Viajes del día (dayTripCount) */}
                      <td className="p-3" style={{ whiteSpace: "nowrap" }}>
                        {d.dayTripCount === 0 ? (
                          <span style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 600 }}>0</span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 11.5,
                              padding: "3px 9px",
                              borderRadius: 8,
                              fontWeight: 800,
                              background: d.dayTripCount >= 5
                                ? "linear-gradient(135deg,#fef3c7,#fde68a)"
                                : "linear-gradient(135deg,#dbeafe,#bfdbfe)",
                              color: d.dayTripCount >= 5 ? "#7a4a00" : "#1e40af",
                              border: d.dayTripCount >= 5 ? "1px solid #fcd34d" : "1px solid #93c5fd",
                            }}
                          >
                            {d.dayTripCount}
                          </span>
                        )}
                      </td>

                      {/* Tipo cliente chips */}
                      <td className="p-3">
                        {(d.allowedClientTypes || []).length === 0 ? (
                          <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 200 }}>
                            {d.allowedClientTypes.map((ct) => {
                              const meta = clientTypeChip(ct);
                              return (
                                <span
                                  key={ct}
                                  style={{
                                    fontSize: 9.5,
                                    padding: "2px 7px",
                                    borderRadius: 6,
                                    fontWeight: 700,
                                    background: meta.bg,
                                    color: meta.color,
                                    border: `1px solid ${meta.border}`,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {meta.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Disciplinas */}
                      <td className="p-3">
                        {(d.disciplines || []).length === 0 ? (
                          <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 220 }}>
                            {d.disciplines.slice(0, 3).map((dx) => (
                              <span
                                key={dx}
                                style={{
                                  fontSize: 10,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  fontWeight: 600,
                                  background: "#f0f9ff",
                                  color: "#0369a1",
                                  border: "1px solid #bae6fd",
                                }}
                              >
                                {dx}
                              </span>
                            ))}
                            {d.disciplines.length > 3 && (
                              <span
                                title={d.disciplines.slice(3).join(", ")}
                                style={{
                                  fontSize: 10,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  border: "1px solid #cbd5e1",
                                }}
                              >
                                +{d.disciplines.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Última conexión */}
                      <td className="p-3" style={{ color: "#475569", whiteSpace: "nowrap", fontSize: 11.5 }}>
                        {ago(d.secondsSinceSeen)}
                      </td>

                      {/* Sesión */}
                      <td className="p-3" style={{ color: "#475569", whiteSpace: "nowrap", fontSize: 11.5 }}>
                        {d.sessionStartedAt ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <span style={{ fontWeight: 600, color: "#334155" }}>
                              {new Date(d.sessionStartedAt).toLocaleTimeString("es-CL", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>
                              {d.heartbeats ?? 0} latidos
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Nunca usó la app</span>
                        )}
                      </td>

                      {/* GPS */}
                      <td className="p-3" style={{ whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 11,
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontWeight: 700,
                            background: gpsActive ? "#dcfce7" : "#f1f5f9",
                            color: gpsActive ? "#166534" : "#94a3b8",
                            border: `1px solid ${gpsActive ? "#86efac" : "#cbd5e1"}`,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: gpsActive ? "#10b981" : "#cbd5e1",
                              boxShadow: gpsActive ? "0 0 6px #10b981" : "none",
                            }}
                          />
                          {gpsActive ? "Reportando" : "Sin señal"}
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

// ────────────────────────────────────────────────────────────────────────────
// FiltersBar — barra de filtros en 2 filas claras
// ────────────────────────────────────────────────────────────────────────────

type FiltersBarProps = {
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  today: string;
  isToday: boolean;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  occupancyFilter: OccupancyFilter;
  setOccupancyFilter: (o: OccupancyFilter) => void;
  clientTypeFilter: string;
  setClientTypeFilter: (s: string) => void;
  disciplineFilter: string;
  setDisciplineFilter: (s: string) => void;
  clientTypeOptions: string[];
  disciplineOptions: string[];
  totalCount: number;
  busyCount: number;
  freeCount: number;
  visibleCount: number;
  hasFilters: boolean;
  clearFilters: () => void;
};

function FiltersBar(p: FiltersBarProps) {
  return (
    <section className="surface rounded-2xl p-5 space-y-3">
      {/* Una sola grilla responsiva — todos los filtros se ven al mismo tiempo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        {/* Fecha */}
        <label className="text-sm block">
          <span className="block mb-1">Fecha</span>
          <input
            type="date"
            className="input"
            value={p.selectedDate}
            max={p.today}
            onChange={(e) => p.setSelectedDate(e.target.value || p.today)}
            style={{
              borderColor: p.isToday ? "var(--brand)" : "#fcd34d",
              background: p.isToday ? "rgba(33,208,179,0.04)" : "#fffbeb",
              fontWeight: 600,
            }}
          />
        </label>

        {/* Buscar */}
        <label className="text-sm block md:col-span-2">
          <span className="block mb-1">Buscar</span>
          <input
            type="text"
            className="input"
            placeholder="Nombre del conductor o plataforma…"
            value={p.searchQuery}
            onChange={(e) => p.setSearchQuery(e.target.value)}
          />
        </label>

        {/* Tipo cliente */}
        <label className="text-sm block">
          <span className="block mb-1">Tipo cliente</span>
          <select
            className="input"
            value={p.clientTypeFilter}
            onChange={(e) => p.setClientTypeFilter(e.target.value)}
            disabled={p.clientTypeOptions.length === 0}
            style={{
              borderColor: p.clientTypeFilter ? "var(--brand)" : undefined,
              fontWeight: p.clientTypeFilter ? 600 : 400,
              opacity: p.clientTypeOptions.length === 0 ? 0.6 : 1,
            }}
          >
            <option value="">
              {p.clientTypeOptions.length === 0
                ? "Sin tipos disponibles"
                : "Todos los tipos"}
            </option>
            {p.clientTypeOptions.map((c) => (
              <option key={c} value={c}>
                {CLIENT_TYPE_META[c.toUpperCase()]?.label ?? c}
              </option>
            ))}
          </select>
        </label>

        {/* Disciplina */}
        <label className="text-sm block">
          <span className="block mb-1">
            Disciplina
            {p.disciplineOptions.length > 0 && (
              <span
                className="ml-1.5 inline-block"
                style={{
                  fontSize: 9,
                  padding: "1px 6px",
                  borderRadius: 8,
                  background: "rgba(33,208,179,0.15)",
                  color: "var(--brand)",
                  fontWeight: 700,
                  letterSpacing: 0,
                  textTransform: "none",
                }}
              >
                {p.disciplineOptions.length}
              </span>
            )}
          </span>
          <select
            className="input"
            value={p.disciplineFilter}
            onChange={(e) => p.setDisciplineFilter(e.target.value)}
            disabled={p.disciplineOptions.length === 0}
            style={{
              borderColor: p.disciplineFilter ? "var(--brand)" : undefined,
              fontWeight: p.disciplineFilter ? 600 : 400,
              opacity: p.disciplineOptions.length === 0 ? 0.6 : 1,
            }}
          >
            <option value="">
              {p.disciplineOptions.length === 0
                ? `Sin disciplinas ${p.isToday ? "hoy" : "este día"}`
                : "Todas las disciplinas"}
            </option>
            {p.disciplineOptions.map((dx) => (
              <option key={dx} value={dx}>
                {dx}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Chips de ocupación + estado del filtro + limpiar */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {([
          { v: "" as OccupancyFilter, label: "Todos", count: p.totalCount },
          { v: "BUSY" as OccupancyFilter, label: "Ocupados", count: p.busyCount },
          { v: "FREE" as OccupancyFilter, label: "Desocupados", count: p.freeCount },
        ]).map((opt) => {
          const active = p.occupancyFilter === opt.v;
          return (
            <button
              key={opt.v || "all"}
              type="button"
              onClick={() => p.setOccupancyFilter(opt.v)}
              className="text-xs font-medium px-3 py-1.5 rounded-full transition-all inline-flex items-center gap-1.5"
              style={{
                background: active
                  ? "linear-gradient(135deg, #21D0B3 0%, #15B09A 100%)"
                  : "#eef1f6",
                color: active ? "#fff" : "#475569",
                boxShadow: active ? "0 1px 4px rgba(33,208,179,0.3)" : "none",
              }}
            >
              {opt.label}
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 10,
                  background: active ? "rgba(255,255,255,0.25)" : "#fff",
                  color: active ? "#fff" : "#64748b",
                  fontWeight: 700,
                }}
              >
                {opt.count}
              </span>
            </button>
          );
        })}

        {/* Spacer + estado/limpiar */}
        <div className="flex-1" />

        {p.hasFilters ? (
          <>
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              <strong style={{ color: "#0f172a" }}>{p.visibleCount}</strong> de {p.totalCount}
            </span>
            <button
              type="button"
              onClick={p.clearFilters}
              className="btn btn-ghost text-xs"
              style={{ padding: "5px 10px" }}
            >
              Limpiar
            </button>
          </>
        ) : (
          !p.isToday && (
            <button
              type="button"
              onClick={() => p.setSelectedDate(p.today)}
              className="btn btn-ghost text-xs"
              style={{ padding: "5px 10px" }}
              title="Volver a hoy"
            >
              ← Volver a hoy
            </button>
          )
        )}
      </div>
    </section>
  );
}
