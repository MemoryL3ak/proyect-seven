
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ResourceScreen from "@/components/ResourceScreen";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { resources } from "@/lib/resources";
import { useI18n } from "@/lib/i18n";

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
  REQUESTED: {
    label: "Solicitado",
    chip: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25",
    panel: "from-amber-500/8 border-amber-500/20"
  },
  SCHEDULED: {
    label: "Programado",
    chip: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/25",
    panel: "from-blue-500/8 border-blue-500/20"
  },
  EN_ROUTE: {
    label: "En ruta a recoger",
    chip: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25",
    panel: "from-emerald-500/8 border-emerald-500/20"
  },
  PICKED_UP: {
    label: "En curso",
    chip: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25",
    panel: "from-emerald-500/8 border-emerald-500/20"
  },
  DROPPED_OFF: {
    label: "Dejado en hotel",
    chip: "bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/25",
    panel: "from-teal-500/8 border-teal-500/20"
  },
  COMPLETED: {
    label: "Completado",
    chip: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/25",
    panel: "from-slate-500/8 border-slate-500/20"
  },
  CANCELLED: {
    label: "Cancelado",
    chip: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25",
    panel: "from-rose-500/8 border-rose-500/20"
  }
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
    const venue = trip.destinationVenueId ? venues[trip.destinationVenueId] : null;
    const etaMinutes = relativeMinutes(trip.scheduledAt);
    const isFresh = freshRequestIds.includes(trip.id);

    return (
      <article
        key={trip.id}
        className={`rounded-[28px] border bg-gradient-to-br p-5 shadow-sm transition ${tone.panel} ${
          isFresh ? "ring-2 ring-emerald-300" : ""
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone.chip}`}>
                {tone.label}
              </span>
              {isFresh && (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/25">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Nueva entrada
                </span>
              )}
            </div>
            <h3 className="mt-3 font-sans font-bold text-2xl text-white">
              {venue?.name || trip.destination || "Solicitud sin destino"}
            </h3>
            <p className="mt-1 text-sm text-white/50">
              {resolveRequestedVehicleType(trip)} · {resolveRequester(trip)} · {resolveDelegation(trip)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Programacion</p>
            <p className="mt-1 text-lg font-semibold text-white">{formatClock(trip.scheduledAt)}</p>
            <p className="text-xs text-white/50">{formatDateTime(trip.scheduledAt)}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Origen</p>
            <p className="mt-2 text-sm font-medium text-white">{safeText(trip.origin)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Sede destino</p>
            <p className="mt-2 text-sm font-medium text-white">{buildVenueAddress(venue)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Despacho</p>
            <p className="mt-2 text-sm font-medium text-white">{resolveDriver(trip)}</p>
            <p className="text-xs text-white/50">{resolveVehicle(trip)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Servicio</p>
            <p className="mt-2 text-sm font-medium text-white">{trip.passengerCount || 0} persona(s)</p>
            <p className="text-xs text-white/50">
              Solicitado {formatDateTime(trip.requestedAt)}
              {etaMinutes !== null
                ? ` · ${
                    etaMinutes >= 0 ? `en ${etaMinutes} min` : `${Math.abs(etaMinutes)} min atrasado`
                  }`
                : ""}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="max-w-3xl text-white/65">
            <span className="font-semibold text-white/90">Observaciones:</span>{" "}
            {safeText(trip.notes, "Sin observaciones operativas.")}
          </p>
          <div className="flex items-center gap-2">
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
                className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 hover:border-emerald-500/50 hover:text-emerald-400"
              >
                Gestionar solicitud
              </button>
            )}
            <Link
              href="/portal/vehicle-request"
              className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
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

      <section className="overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.25),_transparent_32%),linear-gradient(120deg,#081226_0%,#12315f_45%,#0f766e_100%)] px-6 py-7 text-white shadow-[0_25px_70px_rgba(8,18,38,0.22)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.34em] text-white/65">Control de viajes</p>
            <h2 className="mt-3 font-sans font-bold text-4xl leading-tight">Solicitudes, asignación y seguimiento</h2>
            <p className="mt-3 max-w-2xl text-sm text-white/75">
              Vista operativa para revisar solicitudes, programar servicios y monitorear viajes activos.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/60">Ultima sincronizacion</p>
              <p className="mt-2 text-lg font-semibold">
                {lastUpdated ? formatDateTime(lastUpdated.toISOString()) : "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/60">Monitor</p>
              <p className="mt-2 text-lg font-semibold">Auto refresh cada 8 segundos</p>
            </div>
          </div>
        </div>
      </section>

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
          {summaryCards.map((card) => (
            <article key={card.label} className="surface rounded-[28px] p-5 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">{card.label}</p>
              <p className={`mt-3 text-4xl font-sans font-bold ${card.accent}`}>{card.value}</p>
            </article>
          ))}
        </div>
        <article className="surface rounded-[28px] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Filtro operativo</p>
              <h3 className="mt-2 font-sans font-bold text-2xl text-white">Vista de asignación</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAdminEditor((value) => !value);
                setActiveTab("editor");
              }}
              className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 hover:border-emerald-500/50 hover:text-emerald-400"
            >
              {showAdminEditor ? "Ocultar editor" : "Abrir editor manual"}
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-[11px] uppercase tracking-[0.28em] text-white/40">Evento</label>
              <select
                className="input h-12 w-full rounded-2xl"
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
              >
                <option value="">Todos los eventos</option>
                {eventOptions.map((eventItem) => (
                  <option key={eventItem.id} value={eventItem.id}>
                    {eventItem.name || eventItem.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[11px] uppercase tracking-[0.28em] text-white/40">Buscar</label>
              <input
                className="input h-12 w-full rounded-2xl"
                placeholder="Solicitante, delegacion, sede, conductor o patente"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        </article>
      </section>

      <section className="surface rounded-[32px] p-6 shadow-sm">
        <div className="rounded-[28px] border border-white/8 bg-white/5 p-2">
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
                className={`flex items-center justify-between gap-3 rounded-[20px] px-4 py-3 text-left transition ${
                  selected
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/15"
                    : "border border-transparent bg-white/5 text-white/70 hover:border-white/10 hover:bg-white/8"
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`text-[10px] uppercase tracking-[0.24em] ${
                      selected ? "text-emerald-50/80" : "text-white/40"
                    }`}
                  >
                    Vista
                  </p>
                  <p className={`mt-1 truncate text-sm font-semibold ${selected ? "text-white" : "text-white/90"}`}>
                    {tab.label}
                  </p>
                </div>
                <span
                  className={`inline-flex min-w-9 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    selected ? "bg-white text-emerald-700" : "bg-white/15 text-white/70"
                  }`}
                >
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
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Ingresos desde portal</p>
                  <h3 className="mt-2 font-sans font-bold text-3xl text-white">Solicitudes por asignar</h3>
                </div>
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-300">
                  {incomingRequests.length} en cola
                </span>
              </div>
              {incomingRequests.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-white/15 bg-white/5 px-6 py-10 text-center text-white/50">
                  No hay solicitudes nuevas en espera. El panel seguira escuchando entradas del portal.
                </div>
              ) : (
                incomingRequests.map((trip) => renderTripCard(trip, "request"))
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Programacion</p>
                  <h3 className="mt-2 font-sans font-bold text-3xl text-white">Servicios asignados</h3>
                </div>
                <span className="inline-flex items-center rounded-full bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-300">
                  {scheduledQueue.length} viajes
                </span>
              </div>
              {scheduledQueue.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-white/15 bg-white/5 px-6 py-10 text-center text-white/50">
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
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Viajes activos</p>
                <h3 className="mt-2 font-sans font-bold text-3xl text-white">Seguimiento de servicio en curso</h3>
              </div>
              <Link
                href="/operations/vehicle-positions"
                className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 hover:border-blue-500/50 hover:text-blue-400"
              >
                Abrir tracking completo
              </Link>
            </div>
            {activeTrips.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-white/15 bg-white/5 px-6 py-10 text-center text-white/50">
                No hay viajes activos en este momento.
              </div>
            ) : (
              activeTrips.map((trip) => renderTripCard(trip, "active"))
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="mt-6 space-y-6">
            <section>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Bitacora reciente</p>
                  <h3 className="mt-2 font-sans font-bold text-3xl text-white">Ultimos cierres</h3>
                </div>
              </div>
              {completedTrips.length === 0 ? (
                <div className="mt-5 rounded-[28px] border border-dashed border-white/15 bg-white/5 px-6 py-10 text-center text-white/50">
                  Sin viajes completados recientes.
                </div>
              ) : (
                <div className="mt-5 overflow-hidden rounded-[28px] border border-white/10">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Estado</th>
                        <th>Solicitante</th>
                        <th>Sede</th>
                        <th>Conductor</th>
                        <th>Cierre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedTrips.map((trip) => {
                        const tone = statusTone(trip.status);
                        const venue = trip.destinationVenueId ? venues[trip.destinationVenueId] : null;
                        return (
                          <tr key={trip.id}>
                            <td>
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone.chip}`}>
                                {tone.label}
                              </span>
                            </td>
                            <td>{resolveRequester(trip)}</td>
                            <td>{venue?.name || trip.destination || "-"}</td>
                            <td>{resolveDriver(trip)}</td>
                            <td>{formatDateTime(trip.completedAt || trip.updatedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Timeline operativa</p>
                  <h3 className="mt-2 font-sans font-bold text-3xl text-white">Estado general de viajes</h3>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {STATUS_FLOW.map((status) => {
                  const tone = statusTone(status);
                  const items = filteredTrips.filter((trip) => trip.status === status);
                  return (
                    <div key={status} className="rounded-[28px] border border-white/8 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone.chip}`}>
                          {tone.label}
                        </span>
                        <span className="text-sm font-semibold text-white/70">{items.length}</span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {items.slice(0, 4).map((trip) => (
                          <div key={trip.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm">
                            <p className="text-sm font-semibold text-white">{resolveRequester(trip)}</p>
                            <p className="mt-1 text-xs text-white/50">{trip.origin || "Origen pendiente"}</p>
                            <p className="text-xs text-white/50">
                              {trip.destinationVenueId
                                ? venues[trip.destinationVenueId]?.name
                                : trip.destination || "Destino pendiente"}
                            </p>
                          </div>
                        ))}
                        {items.length === 0 && <p className="text-sm text-white/40">Sin viajes.</p>}
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
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Gestion manual</p>
              <h3 className="mt-2 font-sans font-bold text-3xl text-white">Gestión manual de viajes</h3>
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


