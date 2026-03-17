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
      <section
        className="rounded-[28px] p-6 shadow-xl"
        style={{ background: "linear-gradient(135deg, var(--brand-dim) 0%, #e0f2fe 100%)", border: "1px solid var(--info-border)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.28em]" style={{ color: "var(--text-muted)" }}>Jornada operativa</p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight" style={{ color: "var(--text)" }}>{formatDateLong(`${dayKey}T12:00:00`)}</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Vista ejecutiva del dia con llegadas, retiros, vuelos y agenda operativa por delegacion.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>Evento</div>
              <div className="mt-1 font-semibold" style={{ color: "var(--text)" }}>{selectedEvent?.name || "Todos"}</div>
            </div>
            <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>Delegacion</div>
              <div className="mt-1 font-semibold" style={{ color: "var(--text)" }}>{delegationId ? delegationLabel(delegations, delegationId) : "Todas"}</div>
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>Llegadas</div>
            <div className="mt-2 text-4xl font-semibold" style={{ color: "var(--text)" }}>{kpis.arrivals}</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>Retiros</div>
            <div className="mt-2 text-4xl font-semibold" style={{ color: "var(--text)" }}>{kpis.departures}</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>Actividades</div>
            <div className="mt-2 text-4xl font-semibold" style={{ color: "var(--text)" }}>{kpis.activities}</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>Delegaciones activas</div>
            <div className="mt-2 text-4xl font-semibold" style={{ color: "var(--text)" }}>{kpis.activeDelegations}</div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/sports-calendar${eventId || delegationId ? `?eventId=${encodeURIComponent(eventId)}&delegationId=${encodeURIComponent(delegationId)}` : ""}`}
          className="btn btn-ghost"
        >
          Volver al calendario
        </Link>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>

      {loading ? <div className="surface rounded-3xl p-8 text-sm text-white/50">Cargando detalle del dia...</div> : null}

      {!loading ? (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="surface rounded-3xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/50">Llegadas por delegacion</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">Recepcion del dia</h2>
                </div>
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">{arrivals.length} personas</span>
              </div>
              <div className="mt-4 space-y-3">
                {arrivalsByDelegation.length === 0 ? <p className="text-sm text-white/50">No hay llegadas programadas para esta fecha.</p> : null}
                {arrivalsByDelegation.map((group) => (
                  <div key={group.delegationId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{group.delegationLabel}</p>
                        <p className="text-sm text-white/50">{group.people.length} personas arribando</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(group.people.map((item) => item.disciplineId ? (disciplineMap[item.disciplineId] || item.disciplineId) : "Sin disciplina"))).map((discipline) => (
                          <span key={discipline} className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/90">{discipline}</span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {group.people.map((athlete) => {
                        const flight = athlete.arrivalFlightId ? flightMap[athlete.arrivalFlightId] : undefined;
                        return (
                          <div key={athlete.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <p className="text-sm font-semibold text-white">{athlete.fullName || athlete.id}</p>
                            <p className="mt-1 text-xs text-white/50">
                              {athlete.disciplineId ? (disciplineMap[athlete.disciplineId] || athlete.disciplineId) : "Sin disciplina"}
                            </p>
                            <div className="mt-2 space-y-1 text-xs text-white/65">
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

            <div className="surface rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/50">Agenda operativa</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Cronograma del dia</h2>
              <div className="mt-4 space-y-3">
                {dayEntries.length === 0 ? <p className="text-sm text-white/50">No hay actividades registradas para este dia.</p> : null}
                {dayEntries.map((entry) => (
                  <article key={entry.id} className="surface rounded-2xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-white/50">{formatDateTime(entry.startAtUtc)} · {entry.sport} / {entry.league}</p>
                        <h3 className="mt-1 text-lg font-semibold text-white">{titleFromEvent(entry)}</h3>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${scheduleTypeBadgeClass(getMetaString(entry.metadata, "scheduleType"))}`}>
                        {scheduleTypeLabel(getMetaString(entry.metadata, "scheduleType"))}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {getMetaString(entry.metadata, "delegationId") ? (
                        <span className="rounded-full bg-indigo-500/10 px-2 py-1 font-semibold text-indigo-300">
                          {delegationLabel(delegations, getMetaString(entry.metadata, "delegationId"))}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-white/10 px-2 py-1 font-semibold text-white/90">
                        {entry.venue || "Sede por confirmar"}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-1 font-semibold text-white/90">
                        {entry.status || "SCHEDULED"}
                      </span>
                    </div>
                    {entry.source === "and-derived" ? (
                      <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-400">Resumen AND</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-white/10 px-2 py-1 font-semibold text-white/90">
                            {getMetaString(entry.metadata, "peopleCount") || "0"} personas
                          </span>
                          <span className="rounded-full bg-white/10 px-2 py-1 font-semibold text-white/90">
                            {getMetaString(entry.metadata, "disciplineCount") || "0"} disciplinas
                          </span>
                        </div>
                        {getMetaStringArray(entry.metadata, "disciplineNames").length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {getMetaStringArray(entry.metadata, "disciplineNames").map((discipline) => (
                              <span key={discipline} className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/90">
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
          </div>

          <div className="space-y-4">
            <div className="surface rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/50">Operacion terrestre</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Transportes asignados</h2>
              <div className="mt-4 space-y-3">
                {transportAssignments.length === 0 ? <p className="text-sm text-white/50">No hay transportes asociados a las delegaciones del dia.</p> : null}
                {transportAssignments.map((trip) => (
                  <div key={trip.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{tripTypeLabel(trip.tripType)}</p>
                        <p className="text-sm text-white/50">{trip.origin || "Origen por confirmar"} {" -> "} {trip.destination || "Destino por confirmar"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${tripStatusClass(trip.status)}`}>
                        {tripStatusLabel(trip.status)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-white/90 sm:grid-cols-2">
                      <p><strong>Hora:</strong> {trip.timeLabel}</p>
                      <p><strong>Chofer:</strong> {trip.driverName}</p>
                      <p><strong>Vehiculo:</strong> {trip.vehicleLabel}</p>
                      <p><strong>Personas:</strong> {trip.linkedAthletes.length}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {trip.linkedDelegations.map((item) => (
                        <span key={`${trip.id}-${item}`} className="rounded-full bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold text-indigo-300">
                          {delegationLabel(delegations, item)}
                        </span>
                      ))}
                    </div>
                    {trip.linkedAthletes.length ? (
                      <div className="mt-3 border-t border-white/10 pt-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">Pasajeros asociados</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {trip.linkedAthletes.map((athlete) => (
                            <span key={`${trip.id}-${athlete.id}`} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90">
                              {athlete.fullName || athlete.id}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="surface rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/50">Operación aérea</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Vuelos del dia</h2>
              <div className="mt-4 space-y-3">
                {flightsOfDay.length === 0 ? <p className="text-sm text-white/50">No hay vuelos asociados a llegadas en esta fecha.</p> : null}
                {flightsOfDay.map((flight) => (
                  <div key={flight.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{flight.flightLabel}</p>
                        <p className="text-sm text-white/50">{flight.airline} · {flight.origin}</p>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">{flight.people.length} personas</span>
                    </div>
                    <div className="mt-2 text-xs text-white/65">
                      <p><strong>Terminal:</strong> {flight.terminal}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {Array.from(new Set(flight.people.map((person) => delegationLabel(delegations, person.delegationId)))).map((delegation) => (
                        <span key={delegation} className="rounded-full bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold text-indigo-300">
                          {delegation}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/50">Retiros</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Salidas del dia</h2>
              <div className="mt-4 space-y-2">
                {departures.length === 0 ? <p className="text-sm text-white/50">No hay retiros programados para esta fecha.</p> : null}
                {departures.map((athlete) => (
                  <div key={athlete.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{athlete.fullName || athlete.id}</p>
                        <p className="text-sm text-white/50">
                          {delegationLabel(delegations, athlete.delegationId)} · {athlete.disciplineId ? (disciplineMap[athlete.disciplineId] || athlete.disciplineId) : "Sin disciplina"}
                        </p>
                      </div>
                      <span className="rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-400">
                        {formatDateTime(athlete.departureTime)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

