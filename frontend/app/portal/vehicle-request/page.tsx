"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Athlete = {
  id: string;
  fullName?: string | null;
  userType?: string | null;
  eventId?: string | null;
  delegationId?: string | null;
};

type Venue = {
  id: string;
  eventId?: string | null;
  name?: string | null;
  address?: string | null;
  region?: string | null;
  commune?: string | null;
};

type Driver = {
  id: string;
  userId?: string | null;
  fullName?: string | null;
  phone?: string | null;
};

type Vehicle = {
  id: string;
  plate?: string | null;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
};

type Trip = {
  id: string;
  eventId?: string | null;
  requesterAthleteId?: string | null;
  destinationVenueId?: string | null;
  requestedVehicleType?: string | null;
  passengerCount?: number | null;
  driverId?: string | null;
  vehicleId?: string | null;
  status?: string | null;
  tripType?: string | null;
  notes?: string | null;
  requestedAt?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  origin?: string | null;
  destination?: string | null;
  athleteIds?: string[];
  createdAt?: string | null;
};

type EventItem = { id: string; name?: string | null };
type DelegationItem = { id: string; countryCode?: string | null };
type AccessRequestResponse = { message?: string };
type PortalTab = "request" | "status";
type PositionItem = {
  id: string;
  vehicleId: string;
  timestamp: string;
  location?: { coordinates?: [number, number] } | { lat?: number; lng?: number };
  speed?: number | null;
  heading?: number | null;
};

const VEHICLE_TYPES = [
  { label: "Sedan / SUV", value: "SEDAN" },
  { label: "Van", value: "VAN" },
  { label: "Mini bus", value: "MINI_BUS" },
  { label: "Bus", value: "BUS" },
] as const;

const statusMeta: Record<string, { label: string; tone: string; panel: string }> = {
  REQUESTED: {
    label: "Solicitado",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    panel: "from-amber-50 to-white",
  },
  SCHEDULED: {
    label: "Programado",
    tone: "border-sky-200 bg-sky-50 text-sky-800",
    panel: "from-sky-50 to-white",
  },
  EN_ROUTE: {
    label: "En ruta a recoger",
    tone: "border-indigo-200 bg-indigo-50 text-indigo-800",
    panel: "from-indigo-50 to-white",
  },
  PICKED_UP: {
    label: "En curso",
    tone: "border-violet-200 bg-violet-50 text-violet-800",
    panel: "from-violet-50 to-white",
  },
  DROPPED_OFF: {
    label: "Finalizado en destino",
    tone: "border-cyan-200 bg-cyan-50 text-cyan-800",
    panel: "from-cyan-50 to-white",
  },
  COMPLETED: {
    label: "Viaje completado",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    panel: "from-emerald-50 to-white",
  },
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toDateTimeLocalInput(value?: string | Date | null) {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function vehicleTypeLabel(value?: string | null) {
  return VEHICLE_TYPES.find((item) => item.value === value)?.label || value || "-";
}

function venueSummary(venue?: Venue | null) {
  if (!venue) return "Destino por confirmar";
  return [venue.name, venue.address, [venue.commune, venue.region].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ");
}

function normalizeOriginAddress(value?: string | null) {
  if (!value) return "";
  if (/^delegacion\s+[a-z]{2,4}$/i.test(value.trim())) {
    return "";
  }
  return value;
}

function canEditTrip(trip: Trip) {
  if (!trip.scheduledAt) return false;
  const scheduled = new Date(trip.scheduledAt);
  if (Number.isNaN(scheduled.getTime())) return false;
  return scheduled.getTime() - Date.now() > 2 * 60 * 60 * 1000;
}

function getEditDeadline(trip: Trip) {
  if (!trip.scheduledAt) return null;
  const scheduled = new Date(trip.scheduledAt);
  if (Number.isNaN(scheduled.getTime())) return null;
  return new Date(scheduled.getTime() - 2 * 60 * 60 * 1000);
}

function extractCoords(position?: PositionItem | null) {
  if (!position?.location) return null;
  const coordinates = (position.location as { coordinates?: [number, number] }).coordinates;
  const lat = coordinates ? coordinates[1] : (position.location as { lat?: number }).lat;
  const lng = coordinates ? coordinates[0] : (position.location as { lng?: number }).lng;
  if (lat === undefined || lng === undefined) return null;
  return { lat, lng };
}

function buildMapEmbed(lat: number, lng: number) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}&zoom=16`;
}

function buildDirectionsLink(lat: number, lng: number, destination?: string | null) {
  if (!destination) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export default function VehicleRequestPortalPage() {
  const [userCode, setUserCode] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [accessRequestStatus, setAccessRequestStatus] = useState<string | null>(null);
  const [accessRequestError, setAccessRequestError] = useState<string | null>(null);
  const [requestAccessLoading, setRequestAccessLoading] = useState(false);

  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [venues, setVenues] = useState<Venue[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Record<string, Driver>>({});
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [positionsByVehicle, setPositionsByVehicle] = useState<Record<string, PositionItem>>({});

  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("SEDAN");
  const [originAddress, setOriginAddress] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [notes, setNotes] = useState("");
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PortalTab>("request");
  const [visibleTripsCount, setVisibleTripsCount] = useState(5);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadPortal = async (matchedAthlete: Athlete) => {
    const [tripData, venueData, driverData, vehicleData, eventData, delegationData] = await Promise.all([
      apiFetch<Trip[]>("/trips"),
      apiFetch<Venue[]>("/venues"),
      apiFetch<Driver[]>("/drivers"),
      apiFetch<Vehicle[]>("/transports"),
      apiFetch<EventItem[]>("/events"),
      apiFetch<DelegationItem[]>("/delegations"),
    ]);

    setTrips(
      (tripData || [])
        .filter(
          (trip) =>
            (trip.requesterAthleteId && trip.requesterAthleteId === matchedAthlete.id) ||
            (trip.athleteIds || []).includes(matchedAthlete.id),
        )
        .sort(
          (a, b) =>
            new Date(b.requestedAt || b.createdAt || 0).getTime() -
            new Date(a.requestedAt || a.createdAt || 0).getTime(),
        ),
    );
    setVenues(
      (venueData || []).filter(
        (venue) => !matchedAthlete.eventId || venue.eventId === matchedAthlete.eventId,
      ),
    );
    setDrivers(
      (driverData || []).reduce<Record<string, Driver>>((acc, item) => {
        acc[item.id] = item;
        if (item.userId) acc[item.userId] = item;
        return acc;
      }, {}),
    );
    setVehicles(
      (vehicleData || []).reduce<Record<string, Vehicle>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    );
    setEvents(
      (eventData || []).reduce<Record<string, EventItem>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    );
    setDelegations(
      (delegationData || []).reduce<Record<string, DelegationItem>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    );
  };

  const login = async () => {
    const normalized = userCode.trim();
    if (normalized.length < 6) {
      setError("Ingresa un codigo de usuario valido.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const athleteList = await apiFetch<Athlete[]>("/athletes");
      const match = (athleteList || []).find((item) => item.id?.slice(-6) === normalized);
      if (!match) {
        setError("No encontramos un usuario con ese codigo.");
        setAthlete(null);
        return;
      }
      setAthlete(match);
      setActiveTab("request");
      await loadPortal(match);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el portal.");
    } finally {
      setLoading(false);
    }
  };

  const requestAccess = async () => {
    if (!requestEmail.trim()) return;
    setRequestAccessLoading(true);
    setAccessRequestError(null);
    setAccessRequestStatus(null);
    try {
      const response = await apiFetch<AccessRequestResponse>("/athletes/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: requestEmail.trim() }),
      });
      setAccessRequestStatus(response?.message || "Codigo enviado al correo.");
    } catch (err) {
      setAccessRequestError(err instanceof Error ? err.message : "No se pudo solicitar el codigo.");
    } finally {
      setRequestAccessLoading(false);
    }
  };

  const logout = () => {
    setAthlete(null);
    setTrips([]);
    setVenues([]);
    setDrivers({});
    setVehicles({});
    setSelectedVenueId("");
    setRequestedTime("");
    setPassengerCount("1");
    setNotes("");
    setEditingTripId(null);
    setMessage(null);
    setError(null);
    setUserCode("");
  };

  const resetRequestForm = () => {
    setSelectedVehicleType("SEDAN");
    setOriginAddress("");
    setSelectedVenueId("");
    setRequestedTime("");
    setPassengerCount("1");
    setNotes("");
    setEditingTripId(null);
  };

  const cancelTrip = async (trip: Trip) => {
    if (!athlete) return;
    if (!canEditTrip(trip)) {
      setError("La solicitud ya no puede cancelarse porque esta dentro de las 2 horas previas al viaje.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/trips/${trip.id}`, { method: "DELETE" });
      if (editingTripId === trip.id) {
        resetRequestForm();
      }
      setMessage("Solicitud cancelada correctamente.");
      await loadPortal(athlete);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  const startEditingTrip = (trip: Trip) => {
    setEditingTripId(trip.id);
    setSelectedVehicleType(trip.requestedVehicleType || "SEDAN");
    setOriginAddress(normalizeOriginAddress(trip.origin));
    setSelectedVenueId(trip.destinationVenueId || "");
    setRequestedTime(
      trip.scheduledAt && !Number.isNaN(new Date(trip.scheduledAt).getTime())
        ? toDateTimeLocalInput(trip.scheduledAt)
        : "",
    );
    setPassengerCount(String(trip.passengerCount || 1));
    setNotes(trip.notes || "");
    setActiveTab("request");
    setError(null);
    setMessage(null);
  };

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!athlete) return;
    if (!selectedVenueId) {
      setError("Selecciona la sede destino.");
      return;
    }
    if (!originAddress.trim()) {
      setError("Ingresa la direccion de origen.");
      return;
    }
    if (!requestedTime) {
      setError("Indica la hora del servicio.");
      return;
    }
    const normalizedPassengerCount = Number(passengerCount);
    if (!Number.isFinite(normalizedPassengerCount) || normalizedPassengerCount < 1) {
      setError("Indica una cantidad de personas valida.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const venue = venues.find((item) => item.id === selectedVenueId);
      const payload = {
        eventId: athlete.eventId,
        requesterAthleteId: athlete.id,
        athleteIds: [athlete.id],
        tripType: "PORTAL_REQUEST",
        clientType: athlete.userType || "ATHLETE",
        requestedVehicleType: selectedVehicleType,
        passengerCount: normalizedPassengerCount,
        destinationVenueId: selectedVenueId,
        destination: venue?.name || venue?.address || "Sede solicitada",
        origin: originAddress.trim(),
        status: "REQUESTED",
        requestedAt: editingTripId ? undefined : new Date().toISOString(),
        scheduledAt: new Date(requestedTime).toISOString(),
        notes: notes.trim() || undefined,
      };

      await apiFetch(editingTripId ? `/trips/${editingTripId}` : "/trips", {
        method: editingTripId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage(
        editingTripId
          ? "Solicitud actualizada correctamente."
          : "Solicitud enviada. Transporte la revisara en el modulo de viajes.",
      );
      resetRequestForm();
      await loadPortal(athlete);
      setActiveTab("status");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedVenue = useMemo(() => venues.find((item) => item.id === selectedVenueId) || null, [venues, selectedVenueId]);
  const editingTrip = useMemo(() => trips.find((trip) => trip.id === editingTripId) || null, [editingTripId, trips]);
  const visibleTrips = useMemo(() => trips.slice(0, visibleTripsCount), [trips, visibleTripsCount]);
  const hasMoreTrips = trips.length > visibleTripsCount;

  const requestStats = useMemo(() => {
    const requested = trips.filter((trip) => trip.status === "REQUESTED").length;
    const scheduled = trips.filter((trip) => trip.status === "SCHEDULED").length;
    const active = trips.filter((trip) => ["EN_ROUTE", "PICKED_UP"].includes(trip.status || "")).length;
    const completed = trips.filter((trip) => ["DROPPED_OFF", "COMPLETED"].includes(trip.status || "")).length;
    return { requested, scheduled, active, completed };
  }, [trips]);

  useEffect(() => {
    if (!athlete) return;
    const activeTrips = trips.filter((trip) => trip.status === "EN_ROUTE" && trip.vehicleId);
    if (activeTrips.length === 0) {
      setPositionsByVehicle({});
      return;
    }

    let cancelled = false;
    const loadPositions = async () => {
      try {
        const positionData = await apiFetch<PositionItem[]>("/vehicle-positions");
        if (cancelled) return;
        const latestByVehicle: Record<string, PositionItem> = {};
        (positionData || []).forEach((pos) => {
          if (!activeTrips.some((trip) => trip.vehicleId === pos.vehicleId)) return;
          const current = latestByVehicle[pos.vehicleId];
          if (!current || new Date(pos.timestamp).getTime() > new Date(current.timestamp).getTime()) {
            latestByVehicle[pos.vehicleId] = pos;
          }
        });
        setPositionsByVehicle(latestByVehicle);
      } catch {
        // non-blocking
      }
    };

    loadPositions();
    const timer = window.setInterval(loadPositions, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [athlete, trips]);

  useEffect(() => {
    if (activeTab !== "status") return;
    setVisibleTripsCount(5);
  }, [activeTab, athlete?.id]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef2ff_0%,#f8fafc_22%,#f8fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#08152d_0%,#0b4161_52%,#0f766e_100%)] px-6 py-7 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.36em] text-cyan-100/80">Movilidad operativa</p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-[2.5rem]">Portal de solicitudes de vehiculo</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cyan-50/90 sm:text-base">
                Ingresa con tu codigo de usuario, solicita un vehiculo hacia una sede y sigue en tiempo real el estado de asignacion.
              </p>
            </div>
            <div className="grid min-w-[260px] gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">Portal</div>
                <div className="mt-2 text-xl font-semibold">{athlete ? "Sesion activa" : "Acceso privado"}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">Solicitudes</div>
                <div className="mt-2 text-xl font-semibold">{trips.length}</div>
              </div>
            </div>
          </div>
        </section>

        {!athlete ? (
          <section className="grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
            <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Acceso</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Ingresa con tu codigo</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                Usa el mismo codigo corto del portal de usuario para abrir tu panel de movilidad y gestionar solicitudes de vehiculo.
              </p>

              <div className="mt-6 space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Codigo de usuario</span>
                  <input
                    className="input h-12 text-base"
                    value={userCode}
                    onChange={(e) => setUserCode(e.target.value)}
                    placeholder="Ingresa tu codigo"
                  />
                </label>
                <button type="button" className="btn btn-primary h-12 w-full text-base" onClick={login} disabled={loading}>
                  {loading ? "Ingresando..." : "Abrir portal"}
                </button>
                {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              </div>
            </article>

            <article className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-xl shadow-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recuperacion de acceso</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Solicita tu codigo</h2>
                </div>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">Portal seguro</span>
              </div>
              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">
                Si no tienes tu codigo, solicita el acceso con tu correo registrado y luego vuelve para revisar el estado de tus solicitudes.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Correo electronico</span>
                  <input
                    className="input h-12 text-base"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    placeholder="email@dominio.com"
                    type="email"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-ghost h-12 px-5 text-base"
                  onClick={requestAccess}
                  disabled={requestAccessLoading}
                >
                  {requestAccessLoading ? "Enviando..." : "Solicitar codigo"}
                </button>
              </div>
              {accessRequestStatus ? <p className="mt-4 text-sm text-emerald-700">{accessRequestStatus}</p> : null}
              {accessRequestError ? <p className="mt-4 text-sm text-rose-600">{accessRequestError}</p> : null}

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Paso 1</div>
                  <p className="mt-2 text-sm font-medium text-slate-900">Solicita tu codigo</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Paso 2</div>
                  <p className="mt-2 text-sm font-medium text-slate-900">Ingresa al portal</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Paso 3</div>
                  <p className="mt-2 text-sm font-medium text-slate-900">Sigue el estado del viaje</p>
                </div>
              </div>
            </article>
          </section>
        ) : (
          <section className="space-y-6">
            <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Sesion activa</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{athlete.fullName || athlete.id}</h2>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                      Evento: {events[athlete.eventId || ""]?.name || athlete.eventId || "-"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                      Delegacion: {delegations[athlete.delegationId || ""]?.countryCode || athlete.delegationId || "-"}
                    </span>
                  </div>
                </div>
                <button type="button" className="btn btn-ghost h-11 px-5" onClick={logout}>
                  Cerrar sesion
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Solicitadas</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-950">{requestStats.requested}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Programadas</div>
                  <div className="mt-2 text-3xl font-semibold text-sky-700">{requestStats.scheduled}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">En curso</div>
                  <div className="mt-2 text-3xl font-semibold text-indigo-700">{requestStats.active}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Cerradas</div>
                  <div className="mt-2 text-3xl font-semibold text-emerald-700">{requestStats.completed}</div>
                </div>
              </div>
            </article>

            <article className="rounded-[30px] border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/70 sm:p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  className={`rounded-[22px] px-5 py-4 text-left transition ${
                    activeTab === "request"
                      ? "bg-[linear-gradient(135deg,#0b4161_0%,#0f766e_100%)] text-white shadow-lg"
                      : "border border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                  onClick={() => setActiveTab("request")}
                >
                  <div className={`text-xs uppercase tracking-[0.22em] ${activeTab === "request" ? "text-white/70" : "text-slate-500"}`}>Nueva solicitud</div>
                  <div className="mt-2 text-xl font-semibold">Solicitar vehiculo</div>
                  <p className={`mt-2 text-sm leading-6 ${activeTab === "request" ? "text-cyan-50/90" : "text-slate-500"}`}>
                    Registra un nuevo requerimiento operativo hacia una sede.
                  </p>
                </button>
                <button
                  type="button"
                  className={`rounded-[22px] px-5 py-4 text-left transition ${
                    activeTab === "status"
                      ? "bg-[linear-gradient(135deg,#0b4161_0%,#0f766e_100%)] text-white shadow-lg"
                      : "border border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                  onClick={() => setActiveTab("status")}
                >
                  <div className={`text-xs uppercase tracking-[0.22em] ${activeTab === "status" ? "text-white/70" : "text-slate-500"}`}>Estado de servicio</div>
                  <div className="mt-2 text-xl font-semibold">Solicitudes de vehiculo</div>
                  <p className={`mt-2 text-sm leading-6 ${activeTab === "status" ? "text-cyan-50/90" : "text-slate-500"}`}>
                    Revisa asignacion, chofer, vehiculo, patente y programacion.
                  </p>
                </button>
              </div>
            </article>

            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            {activeTab === "request" ? (
              <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Nueva solicitud</p>
                  <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {editingTripId ? "Modificar solicitud" : "Pedir vehiculo"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Selecciona el tipo de vehiculo, la sede, la hora y la cantidad de personas. Puedes modificar la solicitud hasta 2 horas antes del viaje.
                  </p>
                  {editingTrip ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      Editable hasta las <strong>{formatDateTime(getEditDeadline(editingTrip)?.toISOString() || null)}</strong>.
                    </div>
                  ) : null}

                  <form className="mt-6 space-y-4" onSubmit={submitRequest}>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Tipo de vehiculo</span>
                      <select className="input h-12 text-base" value={selectedVehicleType} onChange={(e) => setSelectedVehicleType(e.target.value)}>
                        {VEHICLE_TYPES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Direccion de origen</span>
                      <input
                        className="input h-12 text-base"
                        type="text"
                        value={originAddress}
                        onChange={(e) => setOriginAddress(e.target.value)}
                        placeholder="Ej: Avenida Grecia 1851, Ñuñoa"
                      />
                      <span className="text-xs text-slate-500">
                        Ingresa la direccion exacta donde debe recogerte el conductor.
                      </span>
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Sede destino</span>
                      <select className="input h-12 text-base" value={selectedVenueId} onChange={(e) => setSelectedVenueId(e.target.value)}>
                        <option value="">Selecciona una sede</option>
                        {venues.map((venue) => (
                          <option key={venue.id} value={venue.id}>
                            {venue.name}{venue.address ? ` - ${venue.address}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Hora del servicio</span>
                      <input
                        className="input h-12 w-full text-base"
                        type="datetime-local"
                        value={requestedTime}
                        onChange={(e) => setRequestedTime(e.target.value)}
                      />
                    </label>
                    <label className="block max-w-[220px] space-y-2">
                      <span className="text-sm font-medium text-slate-700">Cantidad de personas</span>
                      <input
                        className="input h-12 text-base"
                        type="number"
                        min={1}
                        step={1}
                        value={passengerCount}
                        onChange={(e) => setPassengerCount(e.target.value)}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Observaciones operativas</span>
                      <textarea
                        className="input min-h-[132px] resize-none text-base"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ej: equipamiento, hora estimada, prioridad o indicacion de acceso"
                      />
                    </label>
                    <button type="submit" className="btn btn-primary h-12 w-full text-base" disabled={submitting}>
                      {submitting
                        ? editingTripId
                          ? "Guardando cambios..."
                          : "Enviando solicitud..."
                        : editingTripId
                          ? "Guardar cambios"
                          : "Guardar solicitud"}
                    </button>
                    {editingTripId ? (
                      <button type="button" className="btn btn-ghost h-12 w-full text-base" onClick={resetRequestForm}>
                        Cancelar edicion
                      </button>
                    ) : null}
                  </form>
                </article>

                <article className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-xl shadow-slate-200/70">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Vista previa</p>
                  <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Resumen del servicio</h3>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Solicitante</div>
                      <div className="mt-2 text-lg font-semibold text-slate-950">{athlete.fullName || athlete.id}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Tipo requerido</div>
                      <div className="mt-2 text-lg font-semibold text-slate-950">{vehicleTypeLabel(selectedVehicleType)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Programacion</div>
                      <div className="mt-2 text-lg font-semibold text-slate-950">
                        {requestedTime ? formatDateTime(new Date(requestedTime).toISOString()) : "Selecciona hora"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Personas</div>
                      <div className="mt-2 text-lg font-semibold text-slate-950">{passengerCount || "1"}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Origen</div>
                      <div className="mt-2 text-lg font-semibold text-slate-950">{originAddress || "Ingresa direccion de origen"}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Sede</div>
                      <div className="mt-2 text-lg font-semibold text-slate-950">{selectedVenue?.name || "Selecciona una sede"}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{venueSummary(selectedVenue)}</p>
                    </div>
                  </div>
                </article>
              </section>
            ) : (
              <section className="space-y-5">
                {trips.length === 0 ? (
                  <article className="rounded-[30px] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Estado de servicio</p>
                    <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Aun no tienes solicitudes</h3>
                    <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
                      Cuando registres una solicitud de vehiculo, aqui veras su estado, la asignacion del chofer y los datos del vehiculo programado.
                    </p>
                  </article>
                ) : (
                  visibleTrips.map((trip) => {
                    const venue = venues.find((item) => item.id === trip.destinationVenueId);
                    const driver = trip.driverId ? drivers[trip.driverId] : null;
                    const vehicle = trip.vehicleId ? vehicles[trip.vehicleId] : null;
                    const status = statusMeta[trip.status || "REQUESTED"] || statusMeta.REQUESTED;
                    const editDeadline = getEditDeadline(trip);
                    const editable = canEditTrip(trip);
                    const livePosition = trip.vehicleId ? positionsByVehicle[trip.vehicleId] : null;
                    const coords = extractCoords(livePosition);
                    const mapEmbedUrl = coords ? buildMapEmbed(coords.lat, coords.lng) : null;
                    return (
                      <article
                        key={trip.id}
                        className={`rounded-[30px] border border-slate-200 bg-gradient-to-br ${status.panel} p-6 shadow-xl shadow-slate-200/50`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Solicitud {trip.id.slice(0, 8)}</p>
                            <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                              {venue?.name || trip.destination || "Destino solicitado"}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {vehicleTypeLabel(trip.requestedVehicleType)} solicitado el {formatDateTime(trip.requestedAt || trip.createdAt)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-4 py-2 text-sm font-semibold ${status.tone}`}>{status.label}</span>
                            {editable ? (
                              <button className="btn btn-ghost h-10 px-4 text-sm" type="button" onClick={() => startEditingTrip(trip)}>
                                Modificar solicitud
                              </button>
                            ) : null}
                            {editable ? (
                              <button className="btn btn-ghost h-10 px-4 text-sm text-rose-700" type="button" onClick={() => cancelTrip(trip)}>
                                Cancelar solicitud
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Sede destino</div>
                              <div className="mt-2 text-lg font-semibold text-slate-950">{venue?.name || "Pendiente"}</div>
                              <p className="mt-2 text-sm leading-6 text-slate-600">{venueSummary(venue)}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Programacion</div>
                              <div className="mt-2 text-lg font-semibold text-slate-950">{formatDateTime(trip.scheduledAt)}</div>
                              <p className="mt-2 text-sm leading-6 text-slate-600">Origen: {trip.origin || "Pendiente"}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Personas</div>
                              <div className="mt-2 text-lg font-semibold text-slate-950">{trip.passengerCount || "-"}</div>
                              <p className="mt-2 text-sm leading-6 text-slate-600">Capacidad requerida para el servicio</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Chofer asignado</div>
                              <div className="mt-2 text-lg font-semibold text-slate-950">{driver?.fullName || "Pendiente de asignacion"}</div>
                              <p className="mt-2 text-sm leading-6 text-slate-600">{driver?.phone || "Telefono aun no disponible"}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Vehiculo</div>
                              <div className="mt-2 text-lg font-semibold text-slate-950">{vehicle?.plate || "Pendiente"}</div>
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {[vehicle?.type, vehicle?.brand, vehicle?.model].filter(Boolean).join(" · ") || "Aun sin datos de unidad"}
                              </p>
                            </div>
                            {trip.status === "EN_ROUTE" || trip.status === "PICKED_UP" ? (
                              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:col-span-2">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <div className="text-xs uppercase tracking-[0.22em] text-emerald-700">Seguimiento en vivo</div>
                                    <div className="mt-2 text-lg font-semibold text-slate-950">
                                      {trip.status === "PICKED_UP" ? "Tu viaje esta en curso" : "Tu conductor va en camino"}
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                      {coords
                                        ? `Ultima actualizacion ${formatDateTime(livePosition?.timestamp)}`
                                        : "Esperando posicion en tiempo real del vehiculo."}
                                    </p>
                                  </div>
                                  {coords ? (
                                    <a
                                      className="btn btn-ghost h-10 px-4 text-sm"
                                      href={buildDirectionsLink(coords.lat, coords.lng, trip.origin)}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Abrir ruta en Maps
                                    </a>
                                  ) : null}
                                </div>
                                <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-white">
                                  {coords && mapEmbedUrl ? (
                                    <iframe
                                      title={`live-map-${trip.id}`}
                                      src={mapEmbedUrl}
                                      className="h-64 w-full"
                                      loading="lazy"
                                    />
                                  ) : coords ? (
                                    <div className="flex h-64 items-center justify-center bg-[radial-gradient(circle_at_top,#dcfce7,transparent_58%),linear-gradient(135deg,#f8fafc,#ecfeff)] px-6 text-center text-sm text-slate-600">
                                      Falta configurar <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> para mostrar el mapa en tiempo real.
                                    </div>
                                  ) : (
                                    <div className="flex h-64 items-center justify-center bg-[radial-gradient(circle_at_top,#dcfce7,transparent_58%),linear-gradient(135deg,#f8fafc,#ecfeff)] px-6 text-center text-sm text-slate-600">
                                      El mapa aparecera apenas el conductor comparta su posicion desde el portal.
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className="rounded-[26px] border border-slate-200 bg-white p-5">
                            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Trazabilidad</div>
                            <div className="mt-4 space-y-3">
                              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                <strong>Estado actual:</strong> {status.label}
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                <strong>Creada:</strong> {formatDateTime(trip.requestedAt || trip.createdAt)}
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                <strong>Destino final:</strong> {trip.destination || venue?.name || "Pendiente"}
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                <strong>Observaciones:</strong> {trip.notes || "Sin observaciones registradas."}
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                <strong>Editable hasta:</strong>{" "}
                                {editDeadline ? formatDateTime(editDeadline.toISOString()) : "-"}
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                <strong>Ventana de cambios:</strong>{" "}
                                {editable
                                  ? "Activa para edicion y cancelacion."
                                  : "Cerrada. Ya esta dentro de las 2 horas previas al viaje."}
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}

                {trips.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <p className="text-sm text-slate-600">
                      Mostrando <strong>{Math.min(visibleTripsCount, trips.length)}</strong> de{" "}
                      <strong>{trips.length}</strong> solicitud(es).
                    </p>
                    <div className="flex items-center gap-2">
                      {hasMoreTrips ? (
                        <button
                          type="button"
                          className="btn btn-ghost h-11 px-5 text-sm"
                          onClick={() => setVisibleTripsCount((current) => current + 5)}
                        >
                          Ver mas solicitudes
                        </button>
                      ) : null}
                      {visibleTripsCount > 5 && trips.length > 5 ? (
                        <button
                          type="button"
                          className="btn btn-ghost h-11 px-5 text-sm"
                          onClick={() => setVisibleTripsCount(5)}
                        >
                          Mostrar menos
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </section>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
