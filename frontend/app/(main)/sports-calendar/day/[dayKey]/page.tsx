"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";

type SportsEvent = {
  id: string;
  eventId?: string | null;
  sport: string;
  league: string;
  season?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  venue?: string | null;
  startAtUtc: string;
  status?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

type EventOption = { id: string; name?: string | null };
type DelegationOption = { id: string; countryCode?: string | null; eventId?: string | null };
type DisciplineOption = { id: string; name?: string | null };
type FlightOption = {
  id: string;
  eventId?: string | null;
  flightNumber?: string | null;
  airline?: string | null;
  origin?: string | null;
  arrivalTime?: string | null;
  terminal?: string | null;
};
type TripOption = {
  id: string;
  eventId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  origin?: string | null;
  destination?: string | null;
  tripType?: string | null;
  clientType?: string | null;
  status?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  athleteIds?: string[];
  committeeValidated?: boolean;
};
type DriverOption = {
  id: string;
  userId?: string | null;
  fullName?: string | null;
};
type VehicleOption = {
  id: string;
  plate?: string | null;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
};
type AthleteDetail = {
  id: string;
  eventId?: string | null;
  delegationId?: string | null;
  disciplineId?: string | null;
  fullName?: string | null;
  countryCode?: string | null;
  passportNumber?: string | null;
  arrivalFlightId?: string | null;
  flightNumber?: string | null;
  airline?: string | null;
  origin?: string | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
};

function getMetaString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function getMetaStringArray(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function titleFromEvent(event: SportsEvent) {
  const metadataTitle = event.metadata?.title;
  if (typeof metadataTitle === "string" && metadataTitle.trim()) return metadataTitle.trim();
  const competitorA = event.homeTeam?.trim() ?? "";
  const competitorB = event.awayTeam?.trim() ?? "";
  if (competitorA && competitorB) return `${competitorA} vs ${competitorB}`;
  if (competitorA) return competitorA;
  return `${event.sport} - ${event.league}`;
}

function scheduleTypeLabel(value?: string | null) {
  if (value === "ARRIVAL") return "Llegada";
  if (value === "TRAINING") return "Entrenamiento";
  if (value === "COMPETITION") return "Prueba";
  if (value === "DEPARTURE") return "Retiro";
  return "Actividad";
}

function scheduleTypeBadgeClass(value?: string | null) {
  if (value === "ARRIVAL") return "bg-blue-500/10 text-blue-400";
  if (value === "TRAINING") return "bg-amber-500/10 text-amber-400";
  if (value === "COMPETITION") return "bg-emerald-500/10 text-emerald-400";
  if (value === "DEPARTURE") return "bg-rose-500/10 text-rose-400";
  return "bg-white/8 text-white/90";
}

function tripStatusLabel(value?: string | null) {
  if (value === "EN_ROUTE") return "En ruta";
  if (value === "SCHEDULED") return "Programado";
  if (value === "PICKED_UP") return "Recogido";
  if (value === "DROPPED_OFF") return "Dejado";
  if (value === "COMPLETED") return "Completado";
  return value || "Sin estado";
}

function tripStatusClass(value?: string | null) {
  if (value === "COMPLETED") return "bg-emerald-500/10 text-emerald-400";
  if (value === "EN_ROUTE" || value === "PICKED_UP") return "bg-amber-500/10 text-amber-400";
  if (value === "DROPPED_OFF") return "bg-blue-500/10 text-blue-400";
  return "bg-white/8 text-white/90";
}

function tripTypeLabel(value?: string | null) {
  if (value === "TRANSFER_IN_OUT") return "Transfer";
  if (value === "DISPOSICION_12H") return "Disposicion 12 h";
  if (value === "IDA_VUELTA") return "Ida y vuelta";
  return value || "Traslado";
}

function formatDateLong(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isoBounds(dayKey: string) {
  const start = new Date(`${dayKey}T00:00:00`);
  const end = new Date(`${dayKey}T23:59:59.999`);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isSameDay(value: string | null | undefined, dayKey: string) {
  if (!value) return false;
  return new Date(value).toISOString().slice(0, 10) === dayKey;
}

function delegationLabel(options: DelegationOption[], id?: string | null) {
  if (!id) return "Sin delegacion";
  return options.find((item) => item.id === id)?.countryCode || id;
}

export default function SportsCalendarDayDetailPage() {
  const params = useParams<{ dayKey: string }>();
  const searchParams = useSearchParams();
  const dayKey = params.dayKey;
  const eventId = searchParams.get("eventId") || "";
  const delegationId = searchParams.get("delegationId") || "";

  const [entries, setEntries] = useState<SportsEvent[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [delegations, setDelegations] = useState<DelegationOption[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineOption[]>([]);
  const [athletes, setAthletes] = useState<AthleteDetail[]>([]);
  const [flights, setFlights] = useState<FlightOption[]>([]);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayTab, setDayTab] = useState<"terrestre" | "llegadas" | "agenda" | "aerea" | "retiros">("terrestre");
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const bounds = isoBounds(dayKey);
        const params = new URLSearchParams({
          from: bounds.start,
          to: bounds.end,
        });
        if (eventId) params.set("eventId", eventId);

        const [entryData, eventData, delegationData, disciplineData, athleteData, flightData, tripData, driverData, vehicleData] = await Promise.all([
          apiFetch<SportsEvent[]>(`/sports-calendar/events?${params.toString()}`),
          apiFetch<EventOption[]>("/events"),
          apiFetch<DelegationOption[]>("/delegations"),
          apiFetch<DisciplineOption[]>("/disciplines"),
          apiFetch<AthleteDetail[]>("/athletes"),
          apiFetch<FlightOption[]>("/flights"),
          apiFetch<TripOption[]>("/trips"),
          apiFetch<DriverOption[]>("/drivers"),
          apiFetch<VehicleOption[]>("/transports"),
        ]);

        setEntries(Array.isArray(entryData) ? entryData : []);
        setEvents(Array.isArray(eventData) ? eventData : []);
        setDelegations(Array.isArray(delegationData) ? delegationData : []);
        setDisciplines(Array.isArray(disciplineData) ? disciplineData : []);
        setAthletes(filterValidatedAthletes(Array.isArray(athleteData) ? athleteData : []));
        setFlights(Array.isArray(flightData) ? flightData : []);
        setTrips(Array.isArray(tripData) ? tripData : []);
        setDrivers(Array.isArray(driverData) ? driverData : []);
        setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el detalle del dia.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [dayKey, eventId]);

  const selectedEvent = useMemo(() => events.find((item) => item.id === eventId), [events, eventId]);
  const disciplineMap = useMemo(
    () => disciplines.reduce<Record<string, string>>((acc, item) => ({ ...acc, [item.id]: item.name || item.id }), {}),
    [disciplines],
  );
  const flightMap = useMemo(
    () => flights.reduce<Record<string, FlightOption>>((acc, item) => ({ ...acc, [item.id]: item }), {}),
    [flights],
  );
  const athleteMap = useMemo(
    () => athletes.reduce<Record<string, AthleteDetail>>((acc, item) => ({ ...acc, [item.id]: item }), {}),
    [athletes],
  );
  const driverMap = useMemo(
    () =>
      drivers.reduce<Record<string, DriverOption>>((acc, item) => {
        acc[item.id] = item;
        if (item.userId) acc[item.userId] = item;
        return acc;
      }, {}),
    [drivers],
  );
  const vehicleMap = useMemo(
    () => vehicles.reduce<Record<string, VehicleOption>>((acc, item) => ({ ...acc, [item.id]: item }), {}),
    [vehicles],
  );

  const scopedAthletes = useMemo(
    () =>
      athletes.filter((item) => {
        if (eventId && item.eventId !== eventId) return false;
        if (delegationId && item.delegationId !== delegationId) return false;
        return true;
      }),
    [athletes, eventId, delegationId],
  );

  const arrivals = useMemo(
    () => scopedAthletes.filter((item) => isSameDay(item.arrivalTime, dayKey)).sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "")),
    [scopedAthletes, dayKey],
  );
  const departures = useMemo(
    () => scopedAthletes.filter((item) => isSameDay(item.departureTime, dayKey)).sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "")),
    [scopedAthletes, dayKey],
  );
  const dayPeopleIds = useMemo(
    () => Array.from(new Set([...arrivals, ...departures].map((item) => item.id))),
    [arrivals, departures],
  );

  const arrivalsByDelegation = useMemo(() => {
    const groups = new Map<string, { delegationId: string; delegationLabel: string; people: AthleteDetail[] }>();
    arrivals.forEach((athlete) => {
      const key = athlete.delegationId || "SIN_DELEGACION";
      const current = groups.get(key) ?? {
        delegationId: key,
        delegationLabel: delegationLabel(delegations, athlete.delegationId),
        people: [],
      };
      current.people.push(athlete);
      groups.set(key, current);
    });
    return Array.from(groups.values()).sort((a, b) => b.people.length - a.people.length);
  }, [arrivals, delegations]);

  const flightsOfDay = useMemo(() => {
    const groups = new Map<string, { key: string; flightLabel: string; airline: string; origin: string; terminal: string; people: AthleteDetail[] }>();
    arrivals.forEach((athlete) => {
      const flight = athlete.arrivalFlightId ? flightMap[athlete.arrivalFlightId] : undefined;
      const key = athlete.arrivalFlightId || athlete.flightNumber || `SIN_VUELO::${athlete.id}`;
      const current = groups.get(key) ?? {
        key,
        flightLabel: flight?.flightNumber || athlete.flightNumber || "Sin vuelo asociado",
        airline: flight?.airline || athlete.airline || "-",
        origin: flight?.origin || athlete.origin || "-",
        terminal: flight?.terminal || "-",
        people: [],
      };
      current.people.push(athlete);
      groups.set(key, current);
    });
    return Array.from(groups.values()).sort((a, b) => b.people.length - a.people.length);
  }, [arrivals, flightMap]);

  const dayEntries = useMemo(
    () =>
      entries
        .filter((entry) => (!delegationId || getMetaString(entry.metadata, "delegationId") === delegationId))
        .sort((a, b) => new Date(a.startAtUtc).getTime() - new Date(b.startAtUtc).getTime()),
    [entries, delegationId],
  );

  const transportAssignments = useMemo(() => {
    const dayPeopleSet = new Set(dayPeopleIds);
    const tripIsOfDay = (trip: TripOption) =>
      isSameDay(trip.scheduledAt, dayKey) || isSameDay(trip.startedAt, dayKey) || isSameDay(trip.completedAt, dayKey);

    return trips
      .filter((trip) => {
        if (eventId && trip.eventId && trip.eventId !== eventId) return false;
        const linkedToDay = (trip.athleteIds || []).some((athleteId) => dayPeopleSet.has(athleteId));
        return linkedToDay || tripIsOfDay(trip);
      })
      .map((trip) => {
        const linkedAthletes = (trip.athleteIds || [])
          .map((athleteId) => athleteMap[athleteId])
          .filter((athlete): athlete is AthleteDetail => Boolean(athlete))
          .filter((athlete) => dayPeopleSet.has(athlete.id));

        const linkedDelegations = Array.from(
          new Set(linkedAthletes.map((athlete) => athlete.delegationId).filter((value): value is string => Boolean(value))),
        );

        if (delegationId && !linkedDelegations.includes(delegationId)) return null;

        const driver = trip.driverId ? driverMap[trip.driverId] : undefined;
        const vehicle = trip.vehicleId ? vehicleMap[trip.vehicleId] : undefined;
        const vehicleParts = [vehicle?.plate, vehicle?.type, [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ")].filter(Boolean);

        return {
          ...trip,
          linkedAthletes,
          linkedDelegations,
          driverName: driver?.fullName || trip.driverId || "-",
          vehicleLabel: vehicleParts.length ? vehicleParts.join(" · ") : trip.vehicleId || "-",
          timeLabel: formatDateTime(trip.startedAt || trip.scheduledAt || trip.completedAt),
        };
      })
      .filter(
        (
          trip,
        ): trip is TripOption & {
          linkedAthletes: AthleteDetail[];
          linkedDelegations: string[];
          driverName: string;
          vehicleLabel: string;
          timeLabel: string;
        } => Boolean(trip),
      )
      .sort((a, b) => {
        const aTime = new Date(a.startedAt || a.scheduledAt || a.completedAt || 0).getTime();
        const bTime = new Date(b.startedAt || b.scheduledAt || b.completedAt || 0).getTime();
        return aTime - bTime;
      });
  }, [athleteMap, dayKey, dayPeopleIds, delegationId, driverMap, eventId, trips, vehicleMap]);

  const kpis = useMemo(() => {
    const activeDelegations = new Set([
      ...arrivals.map((item) => item.delegationId || "SIN_DELEGACION"),
      ...departures.map((item) => item.delegationId || "SIN_DELEGACION"),
      ...dayEntries.map((item) => getMetaString(item.metadata, "delegationId")).filter(Boolean),
    ]);
    return {
      arrivals: arrivals.length,
      departures: departures.length,
      activities: dayEntries.length,
      activeDelegations: activeDelegations.size,
    };
  }, [arrivals, departures, dayEntries]);

  return (
    <div className="space-y-6">
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "20px 24px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", marginBottom: "0" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>Seven Arena</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "2px 10px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#21D0B3", display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "#21D0B3" }}>EN VIVO</span>
              </span>
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", textTransform: "capitalize" }}>{formatDateLong(`${dayKey}T12:00:00`)}</h1>
            <p style={{ marginTop: "2px", fontSize: "13px", color: "#64748b" }}>Vista ejecutiva del dia con llegadas, retiros, vuelos y agenda operativa por delegacion.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ background: "rgba(33,208,179,0.06)", border: "1px solid rgba(33,208,179,0.2)", borderRadius: "10px", padding: "8px 14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>Evento</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{selectedEvent?.name || "Todos"}</div>
            </div>
            <div style={{ background: "rgba(33,208,179,0.06)", border: "1px solid rgba(33,208,179,0.2)", borderRadius: "10px", padding: "8px 14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>Delegacion</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{delegationId ? delegationLabel(delegations, delegationId) : "Todas"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Llegadas", value: kpis.arrivals, color: "#38bdf8" },
          { label: "Retiros", value: kpis.departures, color: "#f472b6" },
          { label: "Actividades", value: kpis.activities, color: "#21D0B3" },
          { label: "Delegaciones activas", value: kpis.activeDelegations, color: "#a78bfa" },
        ].map((kpi) => (
          <div key={kpi.label} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderTop: `3px solid ${kpi.color}`, borderRadius: "16px", padding: "16px 20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", transition: "transform 120ms ease" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: kpi.color }}>{kpi.label}</div>
            <div style={{ marginTop: "8px", fontSize: "2.8rem", fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={
            eventId || delegationId
              ? `/sports-calendar?eventId=${encodeURIComponent(eventId)}&delegationId=${encodeURIComponent(delegationId)}`
              : "/sports-calendar"
          }
          className="btn btn-ghost"
        >
          Volver al calendario
        </Link>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>

      {/* ── Tab navigation ── */}
      {!loading && (
        <div style={{ display: "flex", gap: 0, background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.04)" }}>
          {([
            { key: "terrestre" as const, label: "Op. Terrestre", count: transportAssignments.length, color: "#a78bfa" },
            { key: "llegadas" as const, label: "Llegadas", count: arrivals.length, color: "#38bdf8" },
            { key: "agenda" as const, label: "Agenda Operativa", count: dayEntries.length, color: "#21D0B3" },
            { key: "aerea" as const, label: "Op. Aérea", count: flightsOfDay.length, color: "#fb923c" },
            { key: "retiros" as const, label: "Retiros", count: departures.length, color: "#f472b6" },
          ]).map((tab) => (
            <button key={tab.key} type="button" onClick={() => setDayTab(tab.key)}
              style={{
                flex: 1, padding: "12px 8px", border: "none", cursor: "pointer",
                background: dayTab === tab.key ? `${tab.color}10` : "transparent",
                borderBottom: dayTab === tab.key ? `3px solid ${tab.color}` : "3px solid transparent",
                fontSize: 11, fontWeight: dayTab === tab.key ? 800 : 600,
                color: dayTab === tab.key ? tab.color : "#64748b",
                transition: "all 150ms ease", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              }}>
              {tab.label}
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 99,
                background: dayTab === tab.key ? `${tab.color}18` : "#f1f5f9",
                color: dayTab === tab.key ? tab.color : "#94a3b8",
              }}>{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "32px", fontSize: "13px", color: "#94a3b8" }}>Cargando detalle del dia...</div> : null}

      {!loading ? (
        <section className="space-y-4">

          {/* ═══ TAB: Operación Terrestre ═══ */}
          {dayTab === "terrestre" && (
            <div className="space-y-4">
              {/* Committee validation button */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: "18px 20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8", margin: 0 }}>Validación Comité Organizador</p>
                  <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
                    {transportAssignments.filter((t: any) => t.committeeValidated).length} de {transportAssignments.length} viajes validados
                  </p>
                </div>
                <button type="button" disabled={validating || transportAssignments.length === 0}
                  onClick={async () => {
                    setValidating(true);
                    try {
                      const unvalidated = transportAssignments.filter((t: any) => !t.committeeValidated);
                      for (const trip of unvalidated) {
                        await apiFetch(`/trips/${trip.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ committeeValidated: true, committeeValidatedBy: "Comité Organizador" }),
                        });
                      }
                      // Reload
                      const bounds = isoBounds(dayKey);
                      const p = new URLSearchParams({ from: bounds.start, to: bounds.end });
                      if (eventId) p.set("eventId", eventId);
                      const fresh = await apiFetch<TripOption[]>("/trips");
                      setTrips(Array.isArray(fresh) ? fresh : []);
                    } catch { /* silent */ }
                    setValidating(false);
                  }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "12px 24px", borderRadius: 14, border: "none", cursor: transportAssignments.length === 0 ? "not-allowed" : "pointer",
                    background: transportAssignments.every((t: any) => t.committeeValidated)
                      ? "linear-gradient(135deg, #22c55e, #16a34a)"
                      : "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: "#fff", fontSize: 13, fontWeight: 800,
                    boxShadow: transportAssignments.every((t: any) => t.committeeValidated)
                      ? "0 4px 16px rgba(34,197,94,0.3)"
                      : "0 4px 16px rgba(245,158,11,0.3)",
                    transition: "all 200ms ease",
                    opacity: validating ? 0.7 : 1,
                  }}>
                  {transportAssignments.every((t: any) => t.committeeValidated) ? (
                    <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Validado</>
                  ) : validating ? "Validando..." : (
                    <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg> Validar actividades del día</>
                  )}
                </button>
              </div>

              {/* Transport cards */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 20, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>Operación terrestre</span>
                <h2 style={{ marginTop: 4, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Transportes asignados</h2>
                <div className="mt-4 space-y-3">
                  {transportAssignments.length === 0 ? <p style={{ fontSize: 13, color: "#94a3b8" }}>No hay transportes asociados a las delegaciones del día.</p> : null}
                  {transportAssignments.map((trip) => (
                    <div key={trip.id} style={{ borderRadius: 14, border: `1px solid ${(trip as any).committeeValidated ? "rgba(34,197,94,0.3)" : "#e2e8f0"}`, borderLeft: `3px solid ${(trip as any).committeeValidated ? "#22c55e" : "#a78bfa"}`, background: (trip as any).committeeValidated ? "rgba(34,197,94,0.03)" : "#f8fafc", padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{tripTypeLabel(trip.tripType)}</p>
                          <p style={{ fontSize: 12, color: "#64748b" }}>{trip.origin || "Origen por confirmar"} → {trip.destination || "Destino por confirmar"}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {(trip as any).committeeValidated && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 99, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#22c55e" }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              Validado
                            </span>
                          )}
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${tripStatusClass(trip.status)}`}>{tripStatusLabel(trip.status)}</span>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12, color: "#475569" }}>
                        <p><strong>Hora:</strong> {trip.timeLabel}</p>
                        <p><strong>Chofer:</strong> {trip.driverName}</p>
                        <p><strong>Vehículo:</strong> {trip.vehicleLabel}</p>
                        <p><strong>Personas:</strong> {trip.linkedAthletes.length}</p>
                      </div>
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {trip.linkedDelegations.map((item) => (
                          <span key={`${trip.id}-${item}`} style={{ borderRadius: 99, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", padding: "2px 8px", fontSize: 10, fontWeight: 700, color: "#6366f1" }}>{delegationLabel(delegations, item)}</span>
                        ))}
                      </div>
                      {trip.linkedAthletes.length > 0 && (
                        <div style={{ marginTop: 10, borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
                          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#94a3b8" }}>Pasajeros asociados</p>
                          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {trip.linkedAthletes.map((athlete) => (
                              <span key={`${trip.id}-${athlete.id}`} style={{ borderRadius: 99, background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.2)", padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#21D0B3" }}>{athlete.fullName || athlete.id}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: Llegadas ═══ */}
          {dayTab === "llegadas" && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>Llegadas por delegación</span>
                  <h2 style={{ marginTop: "4px", fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>Recepción del día</h2>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: "99px", padding: "4px 12px", fontSize: "11px", fontWeight: 700, color: "#0ea5e9" }}>{arrivals.length} personas</span>
              </div>
              <div className="mt-4 space-y-3">
                {arrivalsByDelegation.length === 0 ? <p style={{ fontSize: "13px", color: "#94a3b8" }}>No hay llegadas programadas para esta fecha.</p> : null}
                {arrivalsByDelegation.map((group) => (
                  <div key={group.delegationId} style={{ borderRadius: "14px", border: "1px solid #e2e8f0", borderLeft: "3px solid #38bdf8", background: "#f8fafc", padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                      <div>
                        <p style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>{group.delegationLabel}</p>
                        <p style={{ fontSize: "12px", color: "#64748b" }}>{group.people.length} personas arribando</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(group.people.map((item) => item.disciplineId ? (disciplineMap[item.disciplineId] || item.disciplineId) : "Sin disciplina"))).map((discipline) => (
                          <span key={discipline} style={{ borderRadius: "99px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.2)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#21D0B3" }}>{discipline}</span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {group.people.map((athlete) => {
                        const flight = athlete.arrivalFlightId ? flightMap[athlete.arrivalFlightId] : undefined;
                        return (
                          <div key={athlete.id} style={{ borderRadius: "10px", border: "1px solid #e2e8f0", background: "#ffffff", padding: "10px 12px" }}>
                            <p style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{athlete.fullName || athlete.id}</p>
                            <p style={{ marginTop: "2px", fontSize: "11px", color: "#64748b" }}>
                              {athlete.disciplineId ? (disciplineMap[athlete.disciplineId] || athlete.disciplineId) : "Sin disciplina"}
                            </p>
                            <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "2px", fontSize: "11px", color: "#475569" }}>
                              <p><strong>Arribo:</strong> {formatDateTime(athlete.arrivalTime)}</p>
                              <p><strong>Vuelo:</strong> {flight?.airline || athlete.airline || "-"} · {flight?.flightNumber || athlete.flightNumber || "-"}</p>
                              <p><strong>Origen:</strong> {flight?.origin || athlete.origin || "-"}</p>
                              <p><strong>Terminal:</strong> {flight?.terminal || "-"}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ TAB: Agenda Operativa ═══ */}
          {dayTab === "agenda" && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>Agenda operativa</span>
              <h2 style={{ marginTop: "4px", fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>Cronograma del dia</h2>
              <div className="mt-4 space-y-3">
                {dayEntries.length === 0 ? <p style={{ fontSize: "13px", color: "#94a3b8" }}>No hay actividades registradas para este dia.</p> : null}
                {dayEntries.map((entry) => (
                  <article key={entry.id} style={{ borderRadius: "14px", border: "1px solid #e2e8f0", borderLeft: "3px solid #21D0B3", background: "#f8fafc", padding: "14px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                      <div>
                        <p style={{ fontSize: "11px", color: "#94a3b8" }}>{formatDateTime(entry.startAtUtc)} · {entry.sport} / {entry.league}</p>
                        <h3 style={{ marginTop: "2px", fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>{titleFromEvent(entry)}</h3>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${scheduleTypeBadgeClass(getMetaString(entry.metadata, "scheduleType"))}`}>
                        {scheduleTypeLabel(getMetaString(entry.metadata, "scheduleType"))}
                      </span>
                    </div>
                    <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {getMetaString(entry.metadata, "delegationId") ? (
                        <span style={{ borderRadius: "99px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#6366f1" }}>
                          {delegationLabel(delegations, getMetaString(entry.metadata, "delegationId"))}
                        </span>
                      ) : null}
                      <span style={{ borderRadius: "99px", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "2px 8px", fontSize: "10px", fontWeight: 600, color: "#64748b" }}>
                        {entry.venue || "Sede por confirmar"}
                      </span>
                      <span style={{ borderRadius: "99px", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "2px 8px", fontSize: "10px", fontWeight: 600, color: "#64748b" }}>
                        {entry.status || "SCHEDULED"}
                      </span>
                    </div>
                    {entry.source === "and-derived" ? (
                      <div style={{ marginTop: "10px", borderRadius: "10px", border: "1px solid rgba(33,208,179,0.2)", background: "rgba(33,208,179,0.05)", padding: "10px 12px" }}>
                        <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#21D0B3" }}>Resumen AND</p>
                        <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          <span style={{ borderRadius: "99px", background: "rgba(33,208,179,0.08)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#21D0B3" }}>
                            {getMetaString(entry.metadata, "peopleCount") || "0"} personas
                          </span>
                          <span style={{ borderRadius: "99px", background: "rgba(33,208,179,0.08)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#21D0B3" }}>
                            {getMetaString(entry.metadata, "disciplineCount") || "0"} disciplinas
                          </span>
                        </div>
                        {getMetaStringArray(entry.metadata, "disciplineNames").length ? (
                          <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {getMetaStringArray(entry.metadata, "disciplineNames").map((discipline) => (
                              <span key={discipline} style={{ borderRadius: "99px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.2)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#21D0B3" }}>
                                {discipline}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* ═══ TAB: Operación Aérea ═══ */}
          {dayTab === "aerea" && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>Operación aérea</span>
              <h2 style={{ marginTop: "4px", fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>Vuelos del dia</h2>
              <div className="mt-4 space-y-3">
                {flightsOfDay.length === 0 ? <p style={{ fontSize: "13px", color: "#94a3b8" }}>No hay vuelos asociados a llegadas en esta fecha.</p> : null}
                {flightsOfDay.map((flight) => (
                  <div key={flight.key} style={{ borderRadius: "14px", border: "1px solid #e2e8f0", borderLeft: "3px solid #38bdf8", background: "#f8fafc", padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                      <div>
                        <p style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>{flight.flightLabel}</p>
                        <p style={{ fontSize: "12px", color: "#64748b" }}>{flight.airline} · {flight.origin}</p>
                      </div>
                      <span style={{ borderRadius: "99px", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", padding: "3px 10px", fontSize: "11px", fontWeight: 700, color: "#0ea5e9" }}>{flight.people.length} personas</span>
                    </div>
                    <p style={{ marginTop: "6px", fontSize: "12px", color: "#64748b" }}><strong>Terminal:</strong> {flight.terminal}</p>
                    <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {Array.from(new Set(flight.people.map((person) => delegationLabel(delegations, person.delegationId)))).map((delegation) => (
                        <span key={delegation} style={{ borderRadius: "99px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#6366f1" }}>
                          {delegation}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ TAB: Retiros ═══ */}
          {dayTab === "retiros" && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>Retiros</span>
              <h2 style={{ marginTop: "4px", fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>Salidas del dia</h2>
              <div className="mt-4 space-y-2">
                {departures.length === 0 ? <p style={{ fontSize: "13px", color: "#94a3b8" }}>No hay retiros programados para esta fecha.</p> : null}
                {departures.map((athlete) => (
                  <div key={athlete.id} style={{ borderRadius: "12px", border: "1px solid #e2e8f0", borderLeft: "3px solid #f472b6", background: "#f8fafc", padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{athlete.fullName || athlete.id}</p>
                        <p style={{ fontSize: "12px", color: "#64748b" }}>
                          {delegationLabel(delegations, athlete.delegationId)} · {athlete.disciplineId ? (disciplineMap[athlete.disciplineId] || athlete.disciplineId) : "Sin disciplina"}
                        </p>
                      </div>
                      <span style={{ borderRadius: "99px", background: "rgba(244,114,182,0.1)", border: "1px solid rgba(244,114,182,0.25)", padding: "3px 10px", fontSize: "10px", fontWeight: 700, color: "#ec4899" }}>
                        {formatDateTime(athlete.departureTime)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </section>
      ) : null}
    </div>
  );
}
