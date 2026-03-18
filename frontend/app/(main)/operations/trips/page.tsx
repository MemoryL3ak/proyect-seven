
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ResourceScreen from "@/components/ResourceScreen";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { resources } from "@/lib/resources";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

type Trip = {
  id: string;
  eventId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  requesterAthleteId?: string | null;
  destinationVenueId?: string | null;
  requestedVehicleType?: string | null;
  passengerCount?: number | null;
  notes?: string | null;
  requestedAt?: string | null;
  origin?: string | null;
  destination?: string | null;
  tripType?: string | null;
  clientType?: string | null;
  status?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  athleteIds?: string[];
  athleteNames?: string[];
  updatedAt?: string | null;
};

type EventItem = { id: string; name?: string | null };
type AthleteItem = {
  id: string;
  fullName?: string | null;
  delegationId?: string | null;
  eventId?: string | null;
};
type DelegationItem = {
  id: string;
  countryCode?: string | null;
  name?: string | null;
  eventId?: string | null;
};
type DriverItem = {
  id: string;
  userId?: string | null;
  fullName?: string | null;
  phone?: string | null;
};
type VehicleItem = {
  id: string;
  plate?: string | null;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
};
type VenueItem = {
  id: string;
  name?: string | null;
  address?: string | null;
  commune?: string | null;
  region?: string | null;
};

type StatusTone = {
  label: string;
  chip: string;
  panel: string;
};

const STATUS_TONES: Record<string, StatusTone> = {
  REQUESTED: { label: "Solicitado", chip: "", panel: "" },
  SCHEDULED: { label: "Programado", chip: "", panel: "" },
  EN_ROUTE: { label: "En ruta a recoger", chip: "", panel: "" },
  PICKED_UP: { label: "En curso", chip: "", panel: "" },
  DROPPED_OFF: { label: "Dejado en hotel", chip: "", panel: "" },
  COMPLETED: { label: "Completado", chip: "", panel: "" },
  CANCELLED: { label: "Cancelado", chip: "", panel: "" },
};

const STATUS_COLORS: Record<string, { accent: string; chipBg: string; chipBorder: string; pulse: boolean }> = {
  REQUESTED:  { accent: "#f59e0b", chipBg: "rgba(245,158,11,0.12)",  chipBorder: "rgba(245,158,11,0.3)",  pulse: false },
  SCHEDULED:  { accent: "#3b82f6", chipBg: "rgba(59,130,246,0.12)",  chipBorder: "rgba(59,130,246,0.3)",  pulse: false },
  EN_ROUTE:   { accent: "#10b981", chipBg: "rgba(16,185,129,0.12)",  chipBorder: "rgba(16,185,129,0.3)",  pulse: true  },
  PICKED_UP:  { accent: "#10b981", chipBg: "rgba(16,185,129,0.12)",  chipBorder: "rgba(16,185,129,0.3)",  pulse: true  },
  DROPPED_OFF:{ accent: "#14b8a6", chipBg: "rgba(20,184,166,0.12)",  chipBorder: "rgba(20,184,166,0.3)",  pulse: false },
  COMPLETED:  { accent: "#64748b", chipBg: "rgba(100,116,139,0.1)",  chipBorder: "rgba(100,116,139,0.25)", pulse: false },
  CANCELLED:  { accent: "#ef4444", chipBg: "rgba(239,68,68,0.1)",    chipBorder: "rgba(239,68,68,0.25)",  pulse: false },
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  SEDAN: "Sedan / SUV",
  VAN: "Van",
  MINI_BUS: "Mini Bus",
  BUS: "Bus"
};

const STATUS_FLOW = ["REQUESTED", "SCHEDULED", "EN_ROUTE", "PICKED_UP", "COMPLETED"] as const;

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("es-CL", {
        dateStyle: "short",
        timeStyle: "short"
      })
    : "-";

const formatClock = (value?: string | null) =>
  value
    ? new Date(value).toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit"
      })
    : "-";

const safeText = (value?: string | null, fallback = "-") => {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
};

const buildVenueAddress = (venue?: VenueItem | null) => {
  if (!venue) return "-";
  return [venue.address, venue.commune, venue.region].filter(Boolean).join(" · ") || venue.name || "-";
};

const relativeMinutes = (value?: string | null) => {
  if (!value) return null;
  return Math.round((new Date(value).getTime() - Date.now()) / 60000);
};

export default function TripsPage() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const isObsidian = theme === "obsidian";
  const isAtlas = theme === "atlas";
  const isDark = theme === "dark";

  const pal = isObsidian ? {
    cardBg: "#0e1728", cardBorder: "rgba(34,211,238,0.1)", shadow: "0 4px 24px rgba(0,0,0,0.55)",
    textPrimary: "#e2e8f0", textMuted: "rgba(255,255,255,0.45)", labelColor: "rgba(255,255,255,0.35)",
    kpi: ["#f59e0b", "#38bdf8", "#a855f7", "#10b981", "#22d3ee"],
    filterBg: "#0e1728", filterBorder: "rgba(34,211,238,0.1)",
    btnBorder: "rgba(255,255,255,0.2)", btnColor: "rgba(255,255,255,0.7)",
  } : isDark ? {
    cardBg: "var(--surface)", cardBorder: "var(--border)", shadow: "0 2px 12px rgba(0,0,0,0.35)",
    textPrimary: "var(--text)", textMuted: "var(--text-muted)", labelColor: "var(--text-faint)",
    kpi: ["#f59e0b", "#818cf8", "#818cf8", "#10b981", "var(--text-muted)"],
    filterBg: "var(--surface)", filterBorder: "var(--border)",
    btnBorder: "var(--border)", btnColor: "var(--text-muted)",
  } : isAtlas ? {
    cardBg: "#ffffff", cardBorder: "#e2e8f0", shadow: "0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03)",
    textPrimary: "#0f172a", textMuted: "#64748b", labelColor: "#94a3b8",
    kpi: ["#f59e0b", "#3b5bdb", "#6481f0", "#10b981", "#64748b"],
    filterBg: "#ffffff", filterBorder: "#e2e8f0",
    btnBorder: "#e2e8f0", btnColor: "#374151",
  } : {
    cardBg: "#ffffff", cardBorder: "#e2e8f0", shadow: "0 1px 3px rgba(0,0,0,0.06)",
    textPrimary: "#0f172a", textMuted: "#64748b", labelColor: "#94a3b8",
    kpi: ["#f59e0b", "#6366f1", "#6366f1", "#10b981", "#94a3b8"],
    filterBg: "#ffffff", filterBorder: "#e2e8f0",
    btnBorder: "#e2e8f0", btnColor: "#374151",
  };

  const [trips, setTrips] = useState<Trip[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [athletes, setAthletes] = useState<Record<string, AthleteItem>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [drivers, setDrivers] = useState<Record<string, DriverItem>>({});
  const [vehicles, setVehicles] = useState<Record<string, VehicleItem>>({});
  const [venues, setVenues] = useState<Record<string, VenueItem>>({});
  const [selectedEventId, setSelectedEventId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [freshRequestIds, setFreshRequestIds] = useState<string[]>([]);
  const [showAdminEditor, setShowAdminEditor] = useState(false);
  const [activeTab, setActiveTab] = useState<"dispatch" | "active" | "history" | "editor">("dispatch");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const knownRequestedIdsRef = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [tripData, eventData, athleteData, delegationData, driverData, vehicleData, venueData] =
        await Promise.all([
          apiFetch<Trip[]>("/trips"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<AthleteItem[]>("/athletes"),
          apiFetch<DelegationItem[]>("/delegations"),
          apiFetch<DriverItem[]>("/drivers"),
          apiFetch<VehicleItem[]>("/transports"),
          apiFetch<VenueItem[]>("/venues")
        ]);

      const nextTrips = tripData || [];
      const nextRequestedIds = new Set(
        nextTrips.filter((trip) => trip.status === "REQUESTED").map((trip) => trip.id)
      );

      if (knownRequestedIdsRef.current.size > 0) {
        const newIds = Array.from(nextRequestedIds).filter((id) => !knownRequestedIdsRef.current.has(id));
        setFreshRequestIds(newIds);
      }
      knownRequestedIdsRef.current = nextRequestedIds;

      setTrips(nextTrips);
      setEvents(
        (eventData || []).reduce<Record<string, EventItem>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {})
      );
      setAthletes(
        (filterValidatedAthletes(athleteData || [])).reduce<Record<string, AthleteItem>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {})
      );
      setDelegations(
        (delegationData || []).reduce<Record<string, DelegationItem>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {})
      );
      setDrivers(
        (driverData || []).reduce<Record<string, DriverItem>>((acc, item) => {
          acc[item.id] = item;
          if (item.userId) acc[item.userId] = item;
          return acc;
        }, {})
      );
      setVehicles(
        (vehicleData || []).reduce<Record<string, VehicleItem>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {})
      );
      setVenues(
        (venueData || []).reduce<Record<string, VenueItem>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {})
      );

      if (!selectedEventId && eventData && eventData.length > 0) {
        setSelectedEventId(eventData[0].id);
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cargar"));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      if (!mounted) return;
      await loadData(true);
      if (!mounted) return;
      pollTimerRef.current = setTimeout(poll, 8000);
    };

    loadData();
    pollTimerRef.current = setTimeout(poll, 8000);

    return () => {
      mounted = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (freshRequestIds.length === 0) return;
    const timer = setTimeout(() => setFreshRequestIds([]), 20000);
    return () => clearTimeout(timer);
  }, [freshRequestIds]);

  const eventOptions = useMemo(() => Object.values(events), [events]);

  const filteredTrips = useMemo(() => {
    const term = search.trim().toLowerCase();
    return trips
      .filter((trip) => !selectedEventId || trip.eventId === selectedEventId)
      .filter((trip) => {
        if (!term) return true;
        const requester = trip.requesterAthleteId ? athletes[trip.requesterAthleteId]?.fullName : "";
        const delegation = trip.requesterAthleteId
          ? delegations[athletes[trip.requesterAthleteId]?.delegationId || ""]?.countryCode
          : "";
        const venue = trip.destinationVenueId ? venues[trip.destinationVenueId]?.name : "";
        const driver = trip.driverId ? drivers[trip.driverId]?.fullName : "";
        const vehicle = trip.vehicleId ? vehicles[trip.vehicleId]?.plate : "";
        return [
          trip.id,
          trip.origin,
          trip.destination,
          trip.notes,
          requester,
          delegation,
          venue,
          driver,
          vehicle
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const aTime = new Date(a.requestedAt || a.updatedAt || a.scheduledAt || 0).getTime();
        const bTime = new Date(b.requestedAt || b.updatedAt || b.scheduledAt || 0).getTime();
        return bTime - aTime;
      });
  }, [athletes, delegations, drivers, search, selectedEventId, trips, vehicles, venues]);

  const incomingRequests = useMemo(
    () => filteredTrips.filter((trip) => trip.status === "REQUESTED"),
    [filteredTrips]
  );

  const scheduledQueue = useMemo(
    () => filteredTrips.filter((trip) => trip.status === "SCHEDULED"),
    [filteredTrips]
  );

  const activeTrips = useMemo(
    () => filteredTrips.filter((trip) => trip.status === "EN_ROUTE" || trip.status === "PICKED_UP"),
    [filteredTrips]
  );

  const completedTrips = useMemo(
    () =>
      filteredTrips
        .filter((trip) => trip.status === "DROPPED_OFF" || trip.status === "COMPLETED")
        .slice(0, 8),
    [filteredTrips]
  );
  const kpis = useMemo(() => {
    const totalPassengers = filteredTrips.reduce((acc, trip) => acc + (trip.passengerCount || 0), 0);
    const portalTrips = filteredTrips.filter((trip) => trip.tripType === "PORTAL_REQUEST").length;
    return {
      requested: incomingRequests.length,
      scheduled: scheduledQueue.length,
      active: activeTrips.length,
      completed: completedTrips.length,
      passengers: totalPassengers,
      portalTrips
    };
  }, [activeTrips.length, completedTrips.length, filteredTrips, incomingRequests.length, scheduledQueue.length]);

  const resolveRequester = (trip: Trip) => {
    const athlete = trip.requesterAthleteId ? athletes[trip.requesterAthleteId] : null;
    return athlete?.fullName || (trip.athleteNames && trip.athleteNames[0]) || "Sin solicitante";
  };

  const resolveDelegation = (trip: Trip) => {
    const athlete = trip.requesterAthleteId ? athletes[trip.requesterAthleteId] : null;
    if (athlete?.delegationId) {
      const delegation = delegations[athlete.delegationId];
      return delegation?.countryCode || delegation?.name || athlete.delegationId;
    }

    const athleteDelegations = (trip.athleteIds || [])
      .map((athleteId) => athletes[athleteId]?.delegationId)
      .filter((value): value is string => Boolean(value));

    const unique = Array.from(new Set(athleteDelegations)).map((delegationId) => {
      const delegation = delegations[delegationId];
      return delegation?.countryCode || delegation?.name || delegationId;
    });

    return unique.length > 0 ? unique.join(", ") : "-";
  };

  const resolveVehicle = (trip: Trip) => {
    const vehicle = trip.vehicleId ? vehicles[trip.vehicleId] : null;
    if (!vehicle) return "Por asignar";
    return [vehicle.plate, [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || vehicle.type]
      .filter(Boolean)
      .join(" · ");
  };

  const resolveDriver = (trip: Trip) => {
    const driver = trip.driverId ? drivers[trip.driverId] : null;
    return driver?.fullName || "Pendiente de despacho";
  };

  const resolveRequestedVehicleType = (trip: Trip) =>
    VEHICLE_TYPE_LABELS[trip.requestedVehicleType || ""] || trip.requestedVehicleType || "-";

  const statusTone = (status?: string | null) => STATUS_TONES[status || ""] || STATUS_TONES.SCHEDULED;

  const summaryCards = [
    { label: "Solicitudes en cola", value: kpis.requested, accent: "text-amber-400" },
    { label: "Programados", value: kpis.scheduled, accent: "text-blue-400" },
    { label: "Viajes activos", value: kpis.active, accent: "text-indigo-400" },
    { label: "Personas movilizadas", value: kpis.passengers, accent: "text-emerald-400" },
    { label: "Portal de solicitudes", value: kpis.portalTrips, accent: "text-white/50" }
  ];

  const tabs = [
    { key: "dispatch" as const, label: "Por asignar", count: incomingRequests.length + scheduledQueue.length },
    { key: "active" as const, label: "Activos", count: activeTrips.length },
    { key: "history" as const, label: "Historial", count: completedTrips.length },
    { key: "editor" as const, label: "Gestión manual", count: filteredTrips.length }
  ];

  const renderTripCard = (trip: Trip, emphasis: "request" | "dispatch" | "active") => {
    const tone = statusTone(trip.status);
    const sc = STATUS_COLORS[trip.status ?? "SCHEDULED"] ?? STATUS_COLORS.SCHEDULED;
    const venue = trip.destinationVenueId ? venues[trip.destinationVenueId] : null;
    const etaMinutes = relativeMinutes(trip.scheduledAt);
    const isFresh = freshRequestIds.includes(trip.id);

    const chipStyle = {
      background: sc.chipBg,
      border: `1px solid ${sc.chipBorder}`,
      borderRadius: "99px",
      padding: "3px 10px",
      fontSize: "11px",
      fontWeight: 700,
      color: sc.accent,
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
    };
    const infoChipStyle = {
      background: pal.cardBg,
      border: `1px solid ${pal.cardBorder}`,
      borderRadius: "14px",
      padding: "12px 14px",
    };

    return (
      <article
        key={trip.id}
        style={{
          background: pal.cardBg,
          border: `1px solid ${pal.cardBorder}`,
          borderLeft: `4px solid ${sc.accent}`,
          borderRadius: "20px",
          padding: "18px 20px",
          boxShadow: pal.shadow,
          outline: isFresh ? `2px solid #10b981` : "none",
          outlineOffset: "2px",
          transition: "transform 120ms ease, box-shadow 120ms ease",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={chipStyle}>
                {sc.pulse && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: sc.accent, animation: "pulse 1.5s infinite", display: "inline-block" }} />}
                {tone.label}
              </span>
              {isFresh && (
                <span style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700, color: "#10b981", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse 1.5s infinite", display: "inline-block" }} />
                  Nueva entrada
                </span>
              )}
            </div>
            <h3 style={{ marginTop: "10px", fontWeight: 800, fontSize: "18px", color: pal.textPrimary }}>
              {venue?.name || trip.destination || "Solicitud sin destino"}
            </h3>
            <p style={{ marginTop: "3px", fontSize: "13px", color: pal.textMuted }}>
              {resolveRequestedVehicleType(trip)} · {resolveRequester(trip)} · {resolveDelegation(trip)}
            </p>
          </div>
          <div style={{ ...infoChipStyle, textAlign: "right", borderTop: `2px solid ${sc.accent}` }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.labelColor }}>Programación</p>
            <p style={{ marginTop: "4px", fontSize: "17px", fontWeight: 700, color: sc.accent }}>{formatClock(trip.scheduledAt)}</p>
            <p style={{ fontSize: "11px", color: pal.textMuted }}>{formatDateTime(trip.scheduledAt)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Origen", value: safeText(trip.origin), sub: null, icon: "📍" },
            { label: "Sede destino", value: buildVenueAddress(venue), sub: null, icon: "🏟" },
            { label: "Despacho", value: resolveDriver(trip), sub: resolveVehicle(trip), icon: "🚌" },
            { label: "Servicio", value: `${trip.passengerCount || 0} persona(s)`, sub: `Solicitado ${formatDateTime(trip.requestedAt)}${etaMinutes !== null ? ` · ${etaMinutes >= 0 ? `en ${etaMinutes} min` : `${Math.abs(etaMinutes)} min atrasado`}` : ""}`, icon: "👥" },
          ].map((chip) => (
            <div key={chip.label} style={infoChipStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px" }}>{chip.icon}</span>
                <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.labelColor }}>{chip.label}</p>
              </div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: pal.textPrimary }}>{chip.value}</p>
              {chip.sub && <p style={{ fontSize: "11px", color: pal.textMuted, marginTop: "2px" }}>{chip.sub}</p>}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p style={{ fontSize: "13px", color: pal.textMuted, maxWidth: "600px" }}>
            <span style={{ fontWeight: 700, color: pal.textPrimary }}>Observaciones:</span>{" "}
            {safeText(trip.notes, "Sin observaciones operativas.")}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {emphasis === "request" && (
              <button
                type="button"
                onClick={() => {
                  setShowAdminEditor(true);
                  setActiveTab("editor");
                  setSelectedTripId(trip.id);
                  if (typeof window !== "undefined") {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                  }
                }}
                style={{ background: sc.chipBg, border: `1px solid ${sc.chipBorder}`, borderRadius: "99px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: sc.accent, cursor: "pointer" }}
              >
                Gestionar solicitud
              </button>
            )}
            <Link
              href="/portal/vehicle-request"
              style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderRadius: "99px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: pal.textMuted, textDecoration: "none" }}
            >
              Abrir portal usuario
            </Link>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operaciones"
        description="Gestión de viajes."
        action={
          <button className="btn btn-ghost" onClick={() => loadData()} disabled={loading}>
            {loading ? "Actualizando..." : "Refrescar ahora"}
          </button>
        }
      />


      {freshRequestIds.length > 0 && (
        <section className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">
                  Entraron {freshRequestIds.length} solicitud(es) nuevas desde el portal.
                </p>
                <p className="text-sm text-emerald-300/70">
                  La cola de despacho ya se actualizo y queda lista para asignacion.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-emerald-500/30 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/15"
              onClick={() => setFreshRequestIds([])}
            >
              Marcar visto
            </button>
          </div>
        </section>
      )}
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card, i) => (
            <article key={card.label} style={{
              background: pal.cardBg,
              border: `1px solid ${pal.cardBorder}`,
              borderTop: `3px solid ${pal.kpi[i]}`,
              borderRadius: "20px",
              padding: "18px 20px",
              boxShadow: pal.shadow,
            }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{card.label}</span>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: pal.kpi[i], boxShadow: `0 0 6px ${pal.kpi[i]}88`, display: "inline-block" }} />
              </div>
              <p style={{ fontSize: "2.4rem", fontWeight: 800, color: pal.kpi[i], lineHeight: 1, fontVariantNumeric: "tabular-nums",
                ...(isObsidian ? { textShadow: `0 0 20px ${pal.kpi[i]}55` } : {}) }}>
                {loading ? "—" : card.value}
              </p>
            </article>
          ))}
        </div>
        <article style={{ background: pal.filterBg, border: `1px solid ${pal.filterBorder}`, borderRadius: "20px", padding: "20px", boxShadow: pal.shadow }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.labelColor }}>Filtro operativo</p>
              <h3 style={{ marginTop: "4px", fontWeight: 700, fontSize: "18px", color: pal.textPrimary }}>Vista de asignación</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAdminEditor((value) => !value);
                setActiveTab("editor");
              }}
              style={{ border: `1px solid ${pal.btnBorder}`, borderRadius: "99px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: pal.btnColor, background: "transparent", cursor: "pointer" }}
            >
              {showAdminEditor ? "Ocultar editor" : "Abrir editor manual"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>Evento</label>
              <select className="input h-12 w-full rounded-2xl" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
                <option value="">Todos los eventos</option>
                {eventOptions.map((eventItem) => (
                  <option key={eventItem.id} value={eventItem.id}>{eventItem.name || eventItem.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>Buscar</label>
              <input className="input h-12 w-full rounded-2xl" placeholder="Solicitante, delegacion, sede, conductor o patente" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
          {error && <p className="mt-4 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
        </article>
      </section>

      <section style={{ background: pal.filterBg, border: `1px solid ${pal.filterBorder}`, borderRadius: "24px", padding: "20px", boxShadow: pal.shadow }}>
        <div style={{ background: isObsidian || isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", border: `1px solid ${pal.cardBorder}`, borderRadius: "16px", padding: "6px" }}>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key !== "editor") {
                    setShowAdminEditor(false);
                    setSelectedTripId(null);
                  }
                  if (tab.key === "editor") {
                    setShowAdminEditor(true);
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
                  borderRadius: "12px", padding: "10px 14px", textAlign: "left", cursor: "pointer",
                  background: selected ? (isObsidian ? "#10b981" : isAtlas ? "#3b5bdb" : isDark ? "#10b981" : "#16a34a") : "transparent",
                  border: selected ? "none" : `1px solid transparent`,
                  transition: "all 150ms",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: selected ? "rgba(255,255,255,0.7)" : pal.labelColor }}>Vista</p>
                  <p style={{ marginTop: "3px", fontSize: "13px", fontWeight: 700, color: selected ? "#ffffff" : pal.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tab.label}</p>
                </div>
                <span style={{
                  minWidth: "28px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "99px", padding: "3px 8px", fontSize: "12px", fontWeight: 700,
                  background: selected ? "rgba(255,255,255,0.2)" : pal.cardBg,
                  color: selected ? "#ffffff" : pal.textMuted,
                  border: selected ? "none" : `1px solid ${pal.cardBorder}`,
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
          </div>
        </div>

        {activeTab === "dispatch" && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>Ingresos desde portal</p>
                  <h3 className="mt-1 font-sans font-bold text-lg" style={{ color: "var(--text)" }}>Solicitudes por asignar</h3>
                </div>
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-300">
                  {incomingRequests.length} en cola
                </span>
              </div>
              {incomingRequests.length === 0 ? (
                <div style={{ borderRadius: "20px", border: `1px dashed ${pal.cardBorder}`, background: pal.cardBg, padding: "48px 24px", textAlign: "center" as const, color: pal.textMuted, fontSize: "14px" }}>
                  No hay solicitudes nuevas en espera. El panel seguira escuchando entradas del portal.
                </div>
              ) : (
                incomingRequests.map((trip) => renderTripCard(trip, "request"))
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>Programacion</p>
                  <h3 className="mt-1 font-sans font-bold text-lg" style={{ color: "var(--text)" }}>Servicios asignados</h3>
                </div>
                <span className="inline-flex items-center rounded-full bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-300">
                  {scheduledQueue.length} viajes
                </span>
              </div>
              {scheduledQueue.length === 0 ? (
                <div style={{ borderRadius: "20px", border: `1px dashed ${pal.cardBorder}`, background: pal.cardBg, padding: "48px 24px", textAlign: "center" as const, color: pal.textMuted, fontSize: "14px" }}>
                  No hay viajes programados pendientes de salida.
                </div>
              ) : (
                scheduledQueue.slice(0, 8).map((trip) => renderTripCard(trip, "dispatch"))
              )}
            </section>
          </div>
        )}

        {activeTab === "active" && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>Viajes activos</p>
                <h3 className="mt-1 font-sans font-bold text-lg" style={{ color: "var(--text)" }}>Seguimiento de servicio en curso</h3>
              </div>
              <Link
                href="/operations/vehicle-positions"
                className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 hover:border-blue-500/50 hover:text-blue-400"
              >
                Abrir tracking completo
              </Link>
            </div>
            {activeTrips.length === 0 ? (
              <div style={{ borderRadius: "20px", border: `1px dashed ${pal.cardBorder}`, background: pal.cardBg, padding: "48px 24px", textAlign: "center" as const, color: pal.textMuted, fontSize: "14px" }}>
                No hay viajes activos en este momento.
              </div>
            ) : (
              activeTrips.map((trip) => renderTripCard(trip, "active"))
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="mt-6 space-y-6">
            {/* ── Últimos cierres */}
            <section>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>Bitácora reciente</p>
                  <h3 style={{ marginTop: "3px", fontWeight: 700, fontSize: "16px", color: pal.textPrimary }}>Últimos cierres</h3>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 600, color: pal.textMuted, background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderRadius: "99px", padding: "4px 12px" }}>
                  {completedTrips.length} viajes
                </span>
              </div>
              {completedTrips.length === 0 ? (
                <div style={{ borderRadius: "16px", border: `1px dashed ${pal.cardBorder}`, background: pal.cardBg, padding: "40px 24px", textAlign: "center", color: pal.textMuted, fontSize: "14px" }}>
                  Sin viajes completados recientes.
                </div>
              ) : (
                <div style={{ borderRadius: "16px", border: `1px solid ${pal.cardBorder}`, overflow: "hidden", boxShadow: pal.shadow }}>
                  {completedTrips.map((trip, i) => {
                    const sc = STATUS_COLORS[trip.status ?? "COMPLETED"] ?? STATUS_COLORS.COMPLETED;
                    const venue = trip.destinationVenueId ? venues[trip.destinationVenueId] : null;
                    return (
                      <div key={trip.id} style={{
                        display: "grid", gridTemplateColumns: "140px 1fr 1fr 1fr 1fr",
                        gap: "12px", alignItems: "center",
                        padding: "12px 16px",
                        background: i % 2 === 0 ? pal.cardBg : (isObsidian || isDark ? "rgba(255,255,255,0.02)" : "#fafafa"),
                        borderBottom: i < completedTrips.length - 1 ? `1px solid ${pal.cardBorder}` : "none",
                      }}>
                        <span style={{ background: sc.chipBg, border: `1px solid ${sc.chipBorder}`, borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700, color: sc.accent, display: "inline-flex", alignItems: "center", gap: "4px", width: "fit-content" }}>
                          {sc.accent === "#10b981" && <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.accent, display: "inline-block" }} />}
                          {statusTone(trip.status).label}
                        </span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: pal.textPrimary }}>{resolveRequester(trip)}</span>
                        <span style={{ fontSize: "13px", color: pal.textMuted }}>{venue?.name || trip.destination || "-"}</span>
                        <span style={{ fontSize: "13px", color: pal.textMuted }}>{resolveDriver(trip)}</span>
                        <span style={{ fontSize: "12px", color: pal.labelColor, fontVariantNumeric: "tabular-nums" }}>{formatDateTime(trip.completedAt || trip.updatedAt)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Timeline kanban */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>Timeline operativa</p>
                  <h3 style={{ marginTop: "3px", fontWeight: 700, fontSize: "16px", color: pal.textPrimary }}>Estado general de viajes</h3>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {STATUS_FLOW.map((status) => {
                  const sc = STATUS_COLORS[status] ?? STATUS_COLORS.SCHEDULED;
                  const items = filteredTrips.filter((trip) => trip.status === status);
                  const hasItems = items.length > 0;
                  return (
                    <div key={status} style={{
                      background: pal.cardBg,
                      border: `1px solid ${pal.cardBorder}`,
                      borderTop: `3px solid ${sc.accent}`,
                      borderRadius: "16px",
                      padding: "14px",
                      boxShadow: pal.shadow,
                    }}>
                      {/* Column header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: sc.accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                          {statusTone(status).label}
                        </span>
                        <span style={{
                          minWidth: "22px", height: "22px", borderRadius: "99px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: "11px", fontWeight: 800,
                          background: hasItems ? sc.chipBg : (isObsidian || isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9"),
                          color: hasItems ? sc.accent : pal.textMuted,
                          border: hasItems ? `1px solid ${sc.chipBorder}` : `1px solid ${pal.cardBorder}`,
                        }}>
                          {items.length}
                        </span>
                      </div>
                      {/* Mini trip cards */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {items.slice(0, 4).map((trip) => (
                          <div key={trip.id} style={{
                            background: isObsidian || isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
                            border: `1px solid ${pal.cardBorder}`,
                            borderLeft: `3px solid ${sc.accent}`,
                            borderRadius: "10px",
                            padding: "10px 12px",
                          }}>
                            <p style={{ fontSize: "12px", fontWeight: 700, color: pal.textPrimary }}>{resolveRequester(trip)}</p>
                            <p style={{ fontSize: "11px", color: pal.textMuted, marginTop: "2px" }}>{trip.origin || "Origen pendiente"}</p>
                            <p style={{ fontSize: "11px", color: pal.labelColor }}>
                              {trip.destinationVenueId ? venues[trip.destinationVenueId]?.name : trip.destination || "Destino pendiente"}
                            </p>
                          </div>
                        ))}
                        {items.length === 0 && (
                          <p style={{ fontSize: "12px", color: pal.labelColor, textAlign: "center", padding: "16px 0" }}>Sin viajes.</p>
                        )}
                        {items.length > 4 && (
                          <p style={{ fontSize: "11px", color: sc.accent, textAlign: "center", fontWeight: 600 }}>+{items.length - 4} más</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </section>

      {showAdminEditor && activeTab === "editor" && (
        <section className="surface rounded-[32px] p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: pal.labelColor }}>Gestion manual</p>
              <h3 className="mt-1 font-sans font-bold text-lg" style={{ color: "var(--text)" }}>Gestión manual de viajes</h3>
              <p className="mt-2 max-w-2xl text-sm text-white/50">
                Mantiene el CRUD completo para reasignar chofer, vehiculo, estados y datos del viaje
                sin ensuciar la vista principal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowAdminEditor(false); setSelectedTripId(null); }}
              className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 hover:border-white/30"
            >
              Cerrar editor
            </button>
          </div>
          <ResourceScreen config={resources.trips} externalEditingId={selectedTripId} />
        </section>
      )}
    </div>
  );
}


