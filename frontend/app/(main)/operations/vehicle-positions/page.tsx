"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import type { TrackingMarker } from "@/components/LiveTrackingMap";

const LiveTrackingMap = dynamic(() => import("@/components/LiveTrackingMap"), { ssr: false });

type Trip = {
  id: string;
  eventId?: string | null;
  driverId: string;
  vehicleId: string;
  origin?: string | null;
  destination?: string | null;
  destinationVenueId?: string | null;
  tripType?: string | null;
  clientType?: string | null;
  status?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  passengerCount?: number | null;
  athleteIds?: string[];
  athleteNames?: string[];
};

type EventItem = { id: string; name?: string | null };

type DriverItem = { id: string; userId?: string | null; fullName?: string | null };

type VehicleItem = { id: string; plate?: string | null; type?: string | null; brand?: string | null; model?: string | null };

type AthleteItem = { id: string; fullName?: string | null; delegationId?: string | null };

type DelegationItem = { id: string; countryCode?: string | null };

type VenueItem = { id: string; name?: string | null; address?: string | null; commune?: string | null };

const STATUS_COLORS: Record<string, { accent: string; chipBg: string; chipBorder: string }> = {
  EN_ROUTE:   { accent: "#10b981", chipBg: "rgba(16,185,129,0.14)",  chipBorder: "rgba(16,185,129,0.3)"  },
  PICKED_UP:  { accent: "#22d3ee", chipBg: "rgba(34,211,238,0.14)",  chipBorder: "rgba(34,211,238,0.3)"  },
  SCHEDULED:  { accent: "#3b82f6", chipBg: "rgba(59,130,246,0.12)",  chipBorder: "rgba(59,130,246,0.3)"  },
  COMPLETED:  { accent: "#64748b", chipBg: "rgba(100,116,139,0.1)",  chipBorder: "rgba(100,116,139,0.25)" },
  DROPPED_OFF:{ accent: "#14b8a6", chipBg: "rgba(20,184,166,0.12)",  chipBorder: "rgba(20,184,166,0.3)"  },
};

const STATUS_LABEL: Record<string, string> = {
  EN_ROUTE: "En ruta a recoger", PICKED_UP: "En curso", SCHEDULED: "Programado",
  COMPLETED: "Completado", DROPPED_OFF: "Dejado en hotel",
};

type PositionItem = {
  id: string;
  vehicleId: string;
  timestamp: string;
  location?: { coordinates?: [number, number] } | { lat?: number; lng?: number };
};

const statusLabel: Record<string, string> = {
  EN_ROUTE: "En ruta a recoger",
  SCHEDULED: "Programado",
  PICKED_UP: "Recogido",
  DROPPED_OFF: "Dejado en hotel",
  COMPLETED: "Completado"
};

const countryLabels: Record<string, string> = {
  ARG: "Argentina",
  BOL: "Bolivia",
  BRA: "Brasil",
  CHL: "Chile",
  COL: "Colombia",
  ECU: "Ecuador",
  PRY: "Paraguay",
  PER: "Perú",
  URY: "Uruguay",
  VEN: "Venezuela",
  MEX: "México",
  USA: "Estados Unidos",
  CAN: "Canadá",
  ESP: "España",
  FRA: "Francia",
  DEU: "Alemania",
  ITA: "Italia",
  PRT: "Portugal",
  GBR: "Reino Unido"
};

const tripTypeLabels: Record<string, string> = {
  TRANSFER_IN_OUT: "Transfer In Out",
  DISPOSICION_12H: "Disposición 12 horas",
  IDA_VUELTA: "Viaje Ida-Vuelta"
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-CL") : "-";

const formatTripType = (value?: string | null) => {
  if (!value) return "-";
  return tripTypeLabels[value] ?? value;
};

export default function VehiclePositionsPage() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const isObsidian = theme === "obsidian";
  const isAtlas = theme === "atlas";
  const [trips, setTrips] = useState<Trip[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [drivers, setDrivers] = useState<Record<string, DriverItem>>({});
  const [vehicles, setVehicles] = useState<Record<string, VehicleItem>>({});
  const [athletes, setAthletes] = useState<Record<string, AthleteItem>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [venues, setVenues] = useState<Record<string, VenueItem>>({});
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number; timestamp: string }>>({});
  const [completedAlerts, setCompletedAlerts] = useState<Array<{ tripId: string; driverName: string; destination: string; ts: Date }>>([]);
  const [activeView, setActiveView] = useState<"tracking" | "table">("tracking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const knownActiveIdsRef = useRef<Set<string>>(new Set());
  const [mapPreview, setMapPreview] = useState<{
    lat: number;
    lng: number;
    title: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tripData, eventData, driverData, vehicleData, athleteData, delegationData, positionData, venueData] =
        await Promise.all([
          apiFetch<Trip[]>("/trips"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<DriverItem[]>("/drivers"),
          apiFetch<VehicleItem[]>("/transports"),
          apiFetch<AthleteItem[]>("/athletes"),
          apiFetch<DelegationItem[]>("/delegations"),
          apiFetch<PositionItem[]>("/vehicle-positions"),
          apiFetch<VenueItem[]>("/venues")
        ]);

      const nextTrips = tripData || [];

      // Track active → completed for alerts
      const nextActiveIds = new Set(
        nextTrips.filter((t) => ["EN_ROUTE", "PICKED_UP"].includes(t.status ?? "")).map((t) => t.id)
      );
      if (knownActiveIdsRef.current.size > 0) {
        const driverArr = driverData || [];
        const venueArr = venueData || [];
        const newlyCompleted = nextTrips.filter(
          (t) =>
            knownActiveIdsRef.current.has(t.id) &&
            !nextActiveIds.has(t.id) &&
            ["COMPLETED", "DROPPED_OFF"].includes(t.status ?? "")
        );
        if (newlyCompleted.length > 0) {
          const newAlerts = newlyCompleted.map((t) => {
            const driver = driverArr.find((d) => d.id === t.driverId);
            const venue = venueArr.find((v) => v.id === (t as any).destinationVenueId);
            return {
              tripId: t.id,
              driverName: driver?.fullName || "Conductor",
              destination: venue?.name || (t as any).destination || "Destino",
              ts: new Date(),
            };
          });
          setCompletedAlerts((prev) => [...newAlerts, ...prev].slice(0, 8));
        }
      }
      knownActiveIdsRef.current = nextActiveIds;

      setVenues(
        (venueData || []).reduce<Record<string, VenueItem>>((acc, v) => { acc[v.id] = v; return acc; }, {})
      );

      setTrips(nextTrips);

      setEvents(
        (eventData || []).reduce<Record<string, EventItem>>((acc, event) => {
          acc[event.id] = event;
          return acc;
        }, {})
      );

      setDrivers(
        (driverData || []).reduce<Record<string, DriverItem>>((acc, driver) => {
          if (driver.userId) acc[driver.userId] = driver;
          acc[driver.id] = driver;
          return acc;
        }, {})
      );

      setVehicles(
        (vehicleData || []).reduce<Record<string, VehicleItem>>((acc, vehicle) => {
          acc[vehicle.id] = vehicle;
          return acc;
        }, {})
      );

      setAthletes(
        (filterValidatedAthletes(athleteData || [])).reduce<Record<string, AthleteItem>>((acc, athlete) => {
          acc[athlete.id] = athlete;
          return acc;
        }, {})
      );

      setDelegations(
        (delegationData || []).reduce<Record<string, DelegationItem>>((acc, delegation) => {
          acc[delegation.id] = delegation;
          return acc;
        }, {})
      );

      const latestByVehicle: Record<string, { lat: number; lng: number; timestamp: string }> = {};
      (positionData || []).forEach((pos) => {
        const coordinates = (pos.location as any)?.coordinates;
        const lat = coordinates ? coordinates[1] : (pos.location as any)?.lat;
        const lng = coordinates ? coordinates[0] : (pos.location as any)?.lng;
        if (lat === undefined || lng === undefined) return;
        const current = latestByVehicle[pos.vehicleId];
        if (!current || new Date(pos.timestamp) > new Date(current.timestamp)) {
          latestByVehicle[pos.vehicleId] = { lat, lng, timestamp: pos.timestamp };
        }
      });
      setPositions(latestByVehicle);

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cargar"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, []);

  const orderedTrips = useMemo(() => {
    return [...trips].sort((a, b) => {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [trips]);

  const activeTrips = useMemo(
    () => trips.filter((t) => ["EN_ROUTE", "PICKED_UP"].includes(t.status ?? "")),
    [trips]
  );

  const trackingMarkers = useMemo<TrackingMarker[]>(() => {
    return activeTrips
      .map((trip) => {
        const position = positions[trip.vehicleId];
        if (!position) return null;
        const vehicle = vehicles[trip.vehicleId];
        const driver = drivers[trip.driverId];
        const venue = trip.destinationVenueId ? venues[trip.destinationVenueId] : null;
        const sc = STATUS_COLORS[trip.status ?? "EN_ROUTE"] ?? STATUS_COLORS.EN_ROUTE;
        const elapsedMs = trip.startedAt ? Date.now() - new Date(trip.startedAt).getTime() : null;
        return {
          tripId: trip.id,
          lat: position.lat,
          lng: position.lng,
          driverName: driver?.fullName || "Conductor",
          vehiclePlate: vehicle?.plate || trip.vehicleId,
          statusLabel: STATUS_LABEL[trip.status ?? ""] || trip.status || "",
          accent: sc.accent,
          origin: trip.origin || "Origen",
          destination: venue?.name || trip.destination || "Destino",
          elapsedMin: elapsedMs !== null ? Math.floor(elapsedMs / 60000) : null,
          gpsTime: new Date(position.timestamp).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
        } satisfies TrackingMarker;
      })
      .filter((m): m is TrackingMarker => m !== null);
  }, [activeTrips, positions, vehicles, drivers, venues]);

  const tripStats = useMemo(() => {
    const active = trips.filter((tr) => ["EN_ROUTE", "PICKED_UP"].includes(tr.status ?? "")).length;
    const scheduled = trips.filter((tr) => tr.status === "SCHEDULED").length;
    const completed = trips.filter((tr) => ["COMPLETED", "DROPPED_OFF"].includes(tr.status ?? "")).length;
    const withPosition = Object.keys(positions).length;
    return { active, scheduled, completed, withPosition, total: trips.length };
  }, [trips, positions]);

  const resolveDelegations = (trip: Trip) => {
    const ids = (trip.athleteIds || [])
      .map((athleteId) => athletes[athleteId]?.delegationId)
      .filter((value): value is string => Boolean(value));
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return "-";
    const labels = unique
      .map((delegationId) => delegations[delegationId]?.countryCode ?? delegationId)
      .map((code) => countryLabels[code] ?? code);
    return labels.join(", ");
  };

  const resolveAthletes = (trip: Trip) => {
    if (trip.athleteNames && trip.athleteNames.length > 0) {
      return trip.athleteNames.join(", ");
    }
    const names = (trip.athleteIds || [])
      .map((athleteId) => athletes[athleteId]?.fullName)
      .filter((value): value is string => Boolean(value));
    return names.length > 0 ? names.join(", ") : "-";
  };

  const buildMapEmbed = (lat: number, lng: number) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}&zoom=16`;
    }
    const delta = 0.01;
    const left = lng - delta;
    const right = lng + delta;
    const top = lat + delta;
    const bottom = lat - delta;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
  };

  const buildGoogleMapsLink = (lat: number, lng: number) =>
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  const isDark = theme === "dark";
  const isLight = theme === "light";

  const pal = isObsidian ? {
    panelBg: "linear-gradient(135deg, #0a1322 0%, #0e1728 60%, #0d1a30 100%)",
    panelBorder: "1px solid rgba(34,211,238,0.08)",
    panelShadow: "0 4px 32px rgba(0,0,0,0.6)",
    orb1: "rgba(34,211,238,0.07)", orb2: "rgba(168,85,247,0.06)",
    accent: "#22d3ee",
    titleColor: "#e2e8f0", subtitleColor: "rgba(255,255,255,0.45)",
    chipBg: "rgba(255,255,255,0.05)", chipBorder: "rgba(255,255,255,0.1)", chipLabel: "rgba(255,255,255,0.4)",
    btnBg: "rgba(255,255,255,0.07)", btnBorder: "rgba(255,255,255,0.15)", btnColor: "rgba(255,255,255,0.8)",
    kpi: ["#38bdf8", "#10b981", "#f59e0b", "#22d3ee", "#a855f7"],
  } : isDark ? {
    panelBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #111827 100%)",
    panelBorder: "1px solid rgba(255,255,255,0.06)",
    panelShadow: "0 4px 24px rgba(0,0,0,0.45)",
    orb1: "rgba(201,168,76,0.07)", orb2: "rgba(129,140,248,0.06)",
    accent: "#c9a84c",
    titleColor: "#f1f5f9", subtitleColor: "rgba(255,255,255,0.4)",
    chipBg: "rgba(255,255,255,0.04)", chipBorder: "rgba(255,255,255,0.08)", chipLabel: "rgba(255,255,255,0.38)",
    btnBg: "rgba(255,255,255,0.06)", btnBorder: "rgba(255,255,255,0.12)", btnColor: "rgba(255,255,255,0.75)",
    kpi: ["#c9a84c", "#10b981", "#f59e0b", "#818cf8", "#a855f7"],
  } : isAtlas ? {
    panelBg: "linear-gradient(135deg, #ffffff 0%, #f0f4ff 60%, #eef1f8 100%)",
    panelBorder: "1px solid #c7d2fe",
    panelShadow: "0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(59,91,219,0.06)",
    orb1: "rgba(59,91,219,0.06)", orb2: "rgba(100,129,240,0.05)",
    accent: "#3b5bdb",
    titleColor: "#0f172a", subtitleColor: "#64748b",
    chipBg: "#ffffff", chipBorder: "#e2e8f0", chipLabel: "#64748b",
    btnBg: "#ffffff", btnBorder: "#c7d2fe", btnColor: "#3b5bdb",
    kpi: ["#3b5bdb", "#10b981", "#f59e0b", "#6481f0", "#a855f7"],
  } : { // light
    panelBg: "linear-gradient(135deg, #ffffff 0%, #f8fafc 60%, #f1f5f9 100%)",
    panelBorder: "1px solid #e2e8f0",
    panelShadow: "0 1px 4px rgba(0,0,0,0.06)",
    orb1: "rgba(30,58,138,0.04)", orb2: "rgba(124,58,237,0.04)",
    accent: "#1e3a8a",
    titleColor: "#0f172a", subtitleColor: "#64748b",
    chipBg: "#ffffff", chipBorder: "#e2e8f0", chipLabel: "#64748b",
    btnBg: "#ffffff", btnBorder: "#e2e8f0", btnColor: "#374151",
    kpi: ["#1e3a8a", "#10b981", "#f59e0b", "#7c3aed", "#a855f7"],
  };

  return (
    <div className="space-y-6">
      {/* ── Command Panel */}
      <section style={{
        background: pal.panelBg,
        border: pal.panelBorder,
        borderRadius: "20px",
        padding: "24px 28px",
        boxShadow: pal.panelShadow,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background orbs */}
        <div style={{ position: "absolute", top: "-40px", right: "10%", width: "220px", height: "220px", borderRadius: "50%", background: pal.orb1, filter: "blur(50px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-30px", left: "20%", width: "160px", height: "160px", borderRadius: "50%", background: pal.orb2, filter: "blur(40px)", pointerEvents: "none" }} />

        <div className="flex flex-wrap items-start justify-between gap-4" style={{ position: "relative" }}>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.accent }}>
                Operaciones
              </p>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.28)", borderRadius: "99px", padding: "2px 8px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite", display: "inline-block" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#10b981", letterSpacing: "0.08em" }}>EN VIVO</span>
              </span>
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: pal.titleColor, lineHeight: 1.2, marginBottom: "4px" }}>
              Tracking de viajes
            </h1>
            <p style={{ fontSize: "13px", color: pal.subtitleColor }}>
              {lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString("es-CL")}` : "Monitoreo en tiempo real"}
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            style={{
              background: pal.btnBg,
              border: `1px solid ${pal.btnBorder}`,
              borderRadius: "10px",
              padding: "9px 18px",
              color: loading ? pal.subtitleColor : pal.btnColor,
              fontSize: "13px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 150ms",
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}
          >
            <span style={{ fontSize: "14px" }}>↻</span>
            {loading ? t("Actualizando...") : t("Refrescar")}
          </button>
        </div>

        {/* KPI chips */}
        <div className="flex flex-wrap gap-3 mt-5" style={{ position: "relative" }}>
          {[
            { label: "Total viajes", value: tripStats.total, color: pal.kpi[0], icon: "🚌" },
            { label: "En ruta", value: tripStats.active, color: pal.kpi[1], icon: "🟢" },
            { label: "Programados", value: tripStats.scheduled, color: pal.kpi[2], icon: "🕐" },
            { label: "Completados", value: tripStats.completed, color: pal.kpi[3], icon: "✅" },
            { label: "Con GPS", value: tripStats.withPosition, color: pal.kpi[4], icon: "📍" },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: pal.chipBg,
              border: `1px solid ${pal.chipBorder}`,
              borderTop: `2px solid ${stat.color}`,
              borderRadius: "12px",
              padding: "10px 16px",
              minWidth: "110px",
              boxShadow: (isObsidian || isDark) ? "0 2px 8px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
            }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontSize: "13px" }}>{stat.icon}</span>
                <span style={{ fontSize: "10px", color: pal.chipLabel, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{stat.label}</span>
              </div>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: stat.color, lineHeight: 1,
                ...(isObsidian ? { textShadow: `0 0 18px ${stat.color}55` } : {}) }}>
                {loading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
      </section>

      {/* ── View tabs */}
      <section style={{ background: pal.panelBg, border: pal.panelBorder, borderRadius: "16px", padding: "6px", boxShadow: pal.panelShadow }}>
        <div className="grid gap-2 grid-cols-2">
          {([
            { key: "tracking" as const, label: "🗺 Tracking en vivo", count: activeTrips.length },
            { key: "table" as const, label: "📋 Todos los viajes", count: orderedTrips.length },
          ]).map((tab) => {
            const selected = activeView === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveView(tab.key)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
                  borderRadius: "12px", padding: "10px 16px", cursor: "pointer",
                  background: selected ? (isObsidian ? "#10b981" : isAtlas ? "#3b5bdb" : isDark ? "#10b981" : "#16a34a") : "transparent",
                  border: "none", transition: "all 150ms",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 700, color: selected ? "#ffffff" : pal.titleColor }}>{tab.label}</span>
                <span style={{
                  minWidth: "28px", borderRadius: "99px", padding: "3px 8px", fontSize: "12px", fontWeight: 700,
                  background: selected ? "rgba(255,255,255,0.2)" : pal.chipBg,
                  color: selected ? "#ffffff" : pal.subtitleColor,
                  border: selected ? "none" : `1px solid ${pal.chipBorder}`,
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Tracking view */}
      {activeView === "tracking" && (
        <section className="space-y-4">
          {/* Completion alerts */}
          {completedAlerts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {completedAlerts.map((alert, i) => (
                <div key={`${alert.tripId}-${i}`} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.28)",
                  borderRadius: "14px", padding: "12px 18px", gap: "12px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "22px" }}>✅</span>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "#10b981" }}>
                        Viaje completado — {alert.driverName}
                      </p>
                      <p style={{ fontSize: "12px", color: pal.subtitleColor }}>
                        Llegó a {alert.destination} · {alert.ts.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompletedAlerts((prev) => prev.filter((_, j) => j !== i))}
                    style={{ color: pal.subtitleColor, background: "none", border: "none", cursor: "pointer", fontSize: "18px", padding: "4px 8px", lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Big map + sidebar */}
          {activeTrips.length === 0 ? (
            <div style={{
              borderRadius: "20px", border: `1px dashed ${pal.chipBorder}`, background: pal.chipBg,
              padding: "72px 24px", textAlign: "center" as const,
            }}>
              <span style={{ fontSize: "48px", display: "block", marginBottom: "16px" }}>🚌</span>
              <p style={{ fontWeight: 800, fontSize: "18px", color: pal.titleColor }}>Sin viajes activos en este momento</p>
              <p style={{ fontSize: "14px", marginTop: "6px", color: pal.subtitleColor }}>Las rutas aparecerán aquí automáticamente al iniciarse.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px", alignItems: "start" }} className="xl:grid-cols-[1fr_340px] md:!grid-cols-1">

              {/* Map */}
              <div style={{
                borderRadius: "20px",
                overflow: "hidden",
                border: `1px solid ${pal.chipBorder}`,
                boxShadow: (isObsidian || isDark) ? "0 4px 24px rgba(0,0,0,0.55)" : "0 1px 8px rgba(0,0,0,0.08)",
                position: "relative",
              }}>
                {/* Live badge over map */}
                <div style={{ position: "absolute", top: "12px", left: "12px", zIndex: 1000 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    background: "rgba(0,0,0,0.6)", borderRadius: "99px", padding: "5px 12px",
                    backdropFilter: "blur(6px)",
                  }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", animation: "pulse 1.5s infinite", display: "inline-block" }} />
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.1em" }}>
                      {trackingMarkers.length} vehículo(s) en mapa
                    </span>
                  </span>
                </div>
                <LiveTrackingMap
                  markers={trackingMarkers}
                  height={560}
                  isDark={isObsidian || isDark}
                />
              </div>

              {/* Sidebar: trip list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "580px", overflowY: "auto", paddingRight: "2px" }}>
                {activeTrips.map((trip) => {
                  const sc = STATUS_COLORS[trip.status ?? "EN_ROUTE"] ?? STATUS_COLORS.EN_ROUTE;
                  const vehicle = vehicles[trip.vehicleId];
                  const driver = drivers[trip.driverId];
                  const venue = trip.destinationVenueId ? venues[trip.destinationVenueId] : null;
                  const position = positions[trip.vehicleId];
                  const elapsedMs = trip.startedAt ? Date.now() - new Date(trip.startedAt).getTime() : null;
                  const elapsedMin = elapsedMs !== null ? Math.floor(elapsedMs / 60000) : null;

                  return (
                    <div key={trip.id} style={{
                      background: pal.chipBg,
                      border: `1px solid ${pal.chipBorder}`,
                      borderLeft: `4px solid ${sc.accent}`,
                      borderRadius: "14px",
                      padding: "12px 14px",
                      boxShadow: (isObsidian || isDark) ? "0 2px 10px rgba(0,0,0,0.35)" : "0 1px 4px rgba(0,0,0,0.06)",
                      transition: "transform 120ms ease",
                      cursor: position ? "pointer" : "default",
                    }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateX(2px)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
                    >
                      {/* Header row */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px", marginBottom: "8px" }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: "13px", fontWeight: 800, color: pal.titleColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {driver?.fullName || "Conductor pendiente"}
                          </p>
                          <p style={{ fontSize: "11px", color: pal.subtitleColor, marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {vehicle ? [vehicle.plate, vehicle.type].filter(Boolean).join(" · ") : "Sin vehículo"}
                          </p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px", flexShrink: 0 }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: "4px",
                            background: sc.chipBg, border: `1px solid ${sc.chipBorder}`,
                            borderRadius: "99px", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: sc.accent,
                          }}>
                            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.accent, animation: "pulse 1.5s infinite", display: "inline-block" }} />
                            {STATUS_LABEL[trip.status ?? ""] || trip.status}
                          </span>
                          {elapsedMin !== null && (
                            <span style={{ fontSize: "10px", color: pal.subtitleColor }}>⏱ {elapsedMin}m</span>
                          )}
                        </div>
                      </div>

                      {/* Route */}
                      <div style={{ fontSize: "11px", color: pal.subtitleColor, lineHeight: 1.5 }}>
                        <span>📍 {trip.origin || "Origen"}</span>
                        <span style={{ color: pal.chipBorder }}> → </span>
                        <span>🏟 {venue?.name || trip.destination || "Destino"}</span>
                      </div>

                      {/* Footer */}
                      <div style={{ marginTop: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                        <span style={{ fontSize: "10px", color: pal.subtitleColor }}>
                          {trip.passengerCount || 0} pax · {resolveDelegations(trip)}
                        </span>
                        {position ? (
                          <span style={{ fontSize: "10px", color: "#10b981", fontWeight: 600 }}>
                            📡 GPS activo
                          </span>
                        ) : (
                          <span style={{ fontSize: "10px", color: pal.subtitleColor }}>📡 Sin señal</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Table view */}
      {activeView === "table" && (
        <section className="surface rounded-2xl p-6">
          <h2 className="font-sans font-bold text-xl mb-4" style={{ color: "var(--text)" }}>{t("Todos los viajes")}</h2>
          {orderedTrips.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("Sin viajes registrados.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Viaje")}</th>
                    <th>{t("Evento")}</th>
                    <th>{t("Conductor")}</th>
                    <th>{t("Vehículo")}</th>
                    <th>{t("Mapa")}</th>
                    <th>{t("Tipo")}</th>
                    <th>{t("Cliente")}</th>
                    <th>{t("Origen")}</th>
                    <th>{t("Destino")}</th>
                    <th>{t("Delegación")}</th>
                    <th>{t("Participantes")}</th>
                    <th>{t("Programación")}</th>
                    <th>{t("Inicio")}</th>
                    <th>{t("Cierre")}</th>
                    <th>{t("Estado")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedTrips.map((trip) => {
                    const event = trip.eventId ? events[trip.eventId] : null;
                    const driver = drivers[trip.driverId];
                    const vehicle = vehicles[trip.vehicleId];
                    const position = positions[trip.vehicleId];
                    return (
                      <tr key={trip.id}>
                        <td>{trip.id}</td>
                        <td>{event?.name || trip.eventId || "-"}</td>
                        <td>{driver?.fullName || trip.driverId}</td>
                        <td>
                          {vehicle?.plate || trip.vehicleId}
                          {vehicle?.type ? ` (${vehicle.type})` : ""}
                          {vehicle?.brand || vehicle?.model
                            ? ` · ${[vehicle?.brand, vehicle?.model].filter(Boolean).join(" ")}`
                            : ""}
                        </td>
                        <td>
                          {position ? (
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                className="w-56 h-36 rounded-2xl overflow-hidden transition"
                                style={{ border: "1px solid var(--border)" }}
                                onClick={() =>
                                  setMapPreview({ lat: position.lat, lng: position.lng, title: vehicle?.plate || trip.vehicleId })
                                }
                              >
                                <iframe
                                  title={`map-${trip.id}`}
                                  src={buildMapEmbed(position.lat, position.lng)}
                                  className="w-full h-full"
                                  loading="lazy"
                                />
                              </button>
                              <a
                                className="text-xs font-semibold hover:underline"
                                style={{ color: "var(--brand)" }}
                                href={buildGoogleMapsLink(position.lat, position.lng)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {t("Ver en Google Maps")}
                              </a>
                            </div>
                          ) : "-"}
                        </td>
                        <td>{formatTripType(trip.tripType)}</td>
                        <td>{trip.clientType || "-"}</td>
                        <td>{trip.origin || "-"}</td>
                        <td>{trip.destination || "-"}</td>
                        <td>{resolveDelegations(trip)}</td>
                        <td>{resolveAthletes(trip)}</td>
                        <td>{formatDate(trip.scheduledAt)}</td>
                        <td>{formatDate(trip.startedAt)}</td>
                        <td>{formatDate(trip.completedAt)}</td>
                        <td>{statusLabel[trip.status || "SCHEDULED"] || trip.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {mapPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="surface w-full max-w-4xl rounded-3xl p-4 shadow-2xl">
            <div className="flex items-center justify-between px-2 pb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                  {t("Tracking de viajes")}
                </p>
                <h3 className="font-sans font-bold text-xl" style={{ color: "var(--text)" }}>{mapPreview.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  className="btn btn-ghost"
                  href={buildGoogleMapsLink(mapPreview.lat, mapPreview.lng)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("Ver en Google Maps")}
                </a>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => setMapPreview(null)}
                >
                  {t("Cerrar")}
                </button>
              </div>
            </div>
            <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl" style={{ border: "1px solid var(--border)" }}>
              <iframe
                title="map-preview"
                src={buildMapEmbed(mapPreview.lat, mapPreview.lng)}
                className="h-full w-full"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


