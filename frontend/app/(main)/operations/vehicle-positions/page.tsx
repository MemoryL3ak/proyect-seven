"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import type { TrackingMarker } from "@/components/LiveTrackingMap";

const LiveTrackingMap = dynamic(() => import("@/components/LiveTrackingMap"), { ssr: false });

type Trip = {
  id: string;
  eventId?: string | null;
  driverId: string;
  vehicleId: string;
  vehiclePlate?: string | null;
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
  vehicleId?: string;
  driverId?: string;
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
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
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
      const [tripData, eventData, driverData, vehicleData, athleteData, delegationData, positionData, venueData, participantData] =
        await Promise.all([
          apiFetch<Trip[]>("/trips"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<DriverItem[]>("/drivers"),
          apiFetch<VehicleItem[]>("/transports"),
          apiFetch<AthleteItem[]>("/athletes"),
          apiFetch<DelegationItem[]>("/delegations"),
          apiFetch<PositionItem[]>("/vehicle-positions"),
          apiFetch<VenueItem[]>("/venues"),
          apiFetch<Record<string, any>[]>("/provider-participants")
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

      const driverMap = (driverData || []).reduce<Record<string, DriverItem>>((acc, driver) => {
        if (driver.userId) acc[driver.userId] = driver;
        acc[driver.id] = driver;
        return acc;
      }, {});
      (participantData || []).forEach((p) => {
        if (!driverMap[p.id]) {
          driverMap[p.id] = { id: p.id, fullName: p.fullName || p.id, userId: null, vehicleId: null } as any;
        }
      });
      setDrivers(driverMap);

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

      const latestByDriver: Record<string, { lat: number; lng: number; timestamp: string }> = {};
      (positionData || []).forEach((pos) => {
        const key = pos.driverId || pos.vehicleId;
        if (!key) return;
        const coordinates = (pos.location as any)?.coordinates;
        const lat = coordinates ? coordinates[1] : (pos.location as any)?.lat;
        const lng = coordinates ? coordinates[0] : (pos.location as any)?.lng;
        if (lat === undefined || lng === undefined) return;
        const current = latestByDriver[key];
        if (!current || new Date(pos.timestamp) > new Date(current.timestamp)) {
          latestByDriver[key] = { lat, lng, timestamp: pos.timestamp };
        }
      });
      setPositions(latestByDriver);

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
        const position = positions[trip.driverId] || positions[trip.vehicleId];
        if (!position) return null;
        const vehicle = trip.vehicleId ? vehicles[trip.vehicleId] : null;
        const driver = drivers[trip.driverId];
        const venue = trip.destinationVenueId ? venues[trip.destinationVenueId] : null;
        const sc = STATUS_COLORS[trip.status ?? "EN_ROUTE"] ?? STATUS_COLORS.EN_ROUTE;
        const elapsedMs = trip.startedAt ? Date.now() - new Date(trip.startedAt).getTime() : null;
        return {
          tripId: trip.id,
          lat: position.lat,
          lng: position.lng,
          driverName: driver?.fullName || "Conductor",
          vehiclePlate: vehicle?.plate || trip.vehiclePlate || trip.vehicleId,
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
    const activeDriverIds = new Set(
      trips
        .filter((tr) => ["EN_ROUTE", "PICKED_UP"].includes(tr.status ?? ""))
        .map((tr) => tr.driverId)
        .filter(Boolean)
    );
    const withPosition = Object.keys(positions).filter((id) => activeDriverIds.has(id)).length;
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

  // Brand palette — matches app light design system
  const pal = {
    panelBg: "#ffffff",
    panelBorder: "1px solid #e2e8f0",
    panelShadow: "0 1px 4px rgba(15,23,42,0.06)",
    orb1: "rgba(33,208,179,0.07)", orb2: "rgba(31,205,255,0.05)",
    accent: "#21D0B3",
    titleColor: "#0f172a",
    subtitleColor: "#64748b",
    chipBg: "#f8fafc", chipBorder: "#e2e8f0", chipLabel: "#64748b",
    btnBg: "#ffffff", btnBorder: "#e2e8f0", btnColor: "#475569",
    kpi: ["#21D0B3", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"],
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
            { label: "Total viajes", value: tripStats.total, color: pal.kpi[0], icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
            { label: "En ruta", value: tripStats.active, color: pal.kpi[1], icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
            { label: "Programados", value: tripStats.scheduled, color: pal.kpi[2], icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
            { label: "Completados", value: tripStats.completed, color: pal.kpi[3], icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
            { label: "Con GPS", value: tripStats.withPosition, color: pal.kpi[4], icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: pal.chipBg,
              border: `1px solid ${pal.chipBorder}`,
              borderTop: `2px solid ${stat.color}`,
              borderRadius: "12px",
              padding: "10px 16px",
              minWidth: "110px",
              boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
            }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: stat.color }}>{stat.icon}</span>
                <span style={{ fontSize: "10px", color: pal.chipLabel, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{stat.label}</span>
              </div>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                {loading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
      </section>

      {/* ── View tabs */}
      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "6px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div className="grid gap-2 grid-cols-2">
          {([
            { key: "tracking" as const, label: "Tracking en vivo", count: activeTrips.length },
            { key: "table" as const, label: "Todos los viajes", count: orderedTrips.length },
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
                  background: selected ? "#21D0B3" : "transparent",
                  border: "none", transition: "all 150ms",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 700, color: selected ? "#ffffff" : "#0f172a" }}>{tab.label}</span>
                <span style={{
                  minWidth: "28px", borderRadius: "99px", padding: "3px 8px", fontSize: "12px", fontWeight: 700,
                  background: selected ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                  color: selected ? "#ffffff" : "#64748b",
                  border: selected ? "none" : "1px solid #e2e8f0",
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
                    <span style={{ color: "#10b981", flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </span>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "#10b981" }}>
                        Viaje completado — {alert.driverName}
                      </p>
                      <p style={{ fontSize: "12px", color: "#64748b" }}>
                        Llegó a {alert.destination} · {alert.ts.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompletedAlerts((prev) => prev.filter((_, j) => j !== i))}
                    style={{ color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Big map + sidebar */}
          {activeTrips.length === 0 ? (
            <div style={{
              borderRadius: "20px", border: "1px dashed #cbd5e1", background: "#ffffff",
              padding: "72px 24px", textAlign: "center" as const,
              boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
            }}>
              <span style={{ color: "#cbd5e1", display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              </span>
              <p style={{ fontWeight: 800, fontSize: "18px", color: "#0f172a" }}>Sin viajes activos en este momento</p>
              <p style={{ fontSize: "14px", marginTop: "6px", color: "#64748b" }}>Las rutas aparecerán aquí automáticamente al iniciarse.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px", alignItems: "start" }} className="xl:grid-cols-[1fr_340px] md:!grid-cols-1">

              {/* Map */}
              <div style={{
                borderRadius: "20px",
                overflow: "hidden",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 8px rgba(15,23,42,0.08)",
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
                  isDark={false}
                  selectedTripId={selectedTripId}
                />
              </div>

              {/* Sidebar: trip list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "580px", overflowY: "auto", paddingRight: "2px" }}>
                {activeTrips.map((trip) => {
                  const sc = STATUS_COLORS[trip.status ?? "EN_ROUTE"] ?? STATUS_COLORS.EN_ROUTE;
                  const vehicle = trip.vehicleId ? vehicles[trip.vehicleId] : null;
                  const driver = drivers[trip.driverId];
                  const venue = trip.destinationVenueId ? venues[trip.destinationVenueId] : null;
                  const position = positions[trip.driverId] || (trip.vehicleId ? positions[trip.vehicleId] : null);
                  const elapsedMs = trip.startedAt ? Date.now() - new Date(trip.startedAt).getTime() : null;
                  const elapsedMin = elapsedMs !== null ? Math.floor(elapsedMs / 60000) : null;

                  return (
                    <div key={trip.id} style={{
                      background: selectedTripId === trip.id ? "#f0fdfa" : "#ffffff",
                      border: selectedTripId === trip.id ? "2px solid #14b8a6" : "1px solid #e2e8f0",
                      borderLeft: `4px solid ${sc.accent}`,
                      borderRadius: "14px",
                      padding: "12px 14px",
                      boxShadow: selectedTripId === trip.id ? "0 0 8px rgba(20,184,166,0.3)" : "0 1px 4px rgba(15,23,42,0.06)",
                      transition: "transform 120ms ease",
                      cursor: position ? "pointer" : "default",
                    }}
                      onClick={() => { if (position) setSelectedTripId(selectedTripId === trip.id ? null : trip.id); }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateX(2px)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
                    >
                      {/* Header row */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px", marginBottom: "8px" }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {driver?.fullName || "Conductor pendiente"}
                          </p>
                          <p style={{ fontSize: "11px", color: "#64748b", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {vehicle ? [vehicle.plate, vehicle.type].filter(Boolean).join(" · ") : (trip.vehiclePlate || "Sin vehículo")}
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
                            <span style={{ fontSize: "10px", color: "#64748b" }}>{elapsedMin}m</span>
                          )}
                        </div>
                      </div>

                      {/* Route */}
                      <div style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.5, display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2.2" strokeLinecap="round"><path d="M12 22s6-6 6-11a6 6 0 0 0-12 0c0 5 6 11 6 11z"/><circle cx="12" cy="11" r="2"/></svg>
                        <span>{trip.origin || "Origen"}</span>
                        <span style={{ color: "#cbd5e1" }}>→</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2"/></svg>
                        <span>{venue?.name || trip.destination || "Destino"}</span>
                      </div>

                      {/* Footer */}
                      <div style={{ marginTop: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                        <span style={{ fontSize: "10px", color: "#64748b" }}>
                          {trip.passengerCount || 0} pax · {resolveDelegations(trip)}
                        </span>
                        {position ? (
                          <span style={{ fontSize: "10px", color: "#10b981", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>
                            GPS activo
                          </span>
                        ) : (
                          <span style={{ fontSize: "10px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>
                            Sin señal</span>
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
        <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "16px" }}>{t("Todos los viajes")}</h2>
          {orderedTrips.length === 0 ? (
            <p style={{ fontSize: "14px", color: "#64748b" }}>{t("Sin viajes registrados.")}</p>
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
                    const vehicle = trip.vehicleId ? vehicles[trip.vehicleId] : null;
                    const position = positions[trip.driverId] || (trip.vehicleId ? positions[trip.vehicleId] : null);
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
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.4)", padding: "16px", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#ffffff", width: "100%", maxWidth: "900px", borderRadius: "20px", padding: "20px", boxShadow: "0 24px 64px rgba(15,23,42,0.22)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "#21D0B3" }}>{t("Tracking de viajes")}</p>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>{mapPreview.title}</h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <a
                  href={buildGoogleMapsLink(mapPreview.lat, mapPreview.lng)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#475569", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}
                >
                  {t("Ver en Google Maps")}
                </a>
                <button
                  type="button"
                  onClick={() => setMapPreview(null)}
                  style={{ padding: "8px 16px", borderRadius: "10px", border: "none", background: "#21D0B3", color: "#ffffff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  {t("Cerrar")}
                </button>
              </div>
            </div>
            <div style={{ aspectRatio: "16/9", width: "100%", overflow: "hidden", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <iframe title="map-preview" src={buildMapEmbed(mapPreview.lat, mapPreview.lng)} style={{ width: "100%", height: "100%" }} loading="lazy" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


