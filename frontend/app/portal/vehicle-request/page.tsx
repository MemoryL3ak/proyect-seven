"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import PlacesAutocompleteInput from "@/components/PlacesAutocompleteInput";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import NotificationBell, { useNotifications } from "@/components/NotificationBell";
import TripChat from "@/components/TripChat";

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
  passengerLat?: number | null;
  passengerLng?: number | null;
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
    tone: "border-amber-400 bg-amber-50 text-amber-700",
    panel: "",
  },
  SCHEDULED: {
    label: "Programado",
    tone: "border-sky-400 bg-sky-50 text-sky-700",
    panel: "",
  },
  EN_ROUTE: {
    label: "En ruta a recoger",
    tone: "border-indigo-400 bg-indigo-50 text-indigo-700",
    panel: "",
  },
  PICKED_UP: {
    label: "En curso",
    tone: "border-violet-400 bg-violet-50 text-violet-700",
    panel: "",
  },
  DROPPED_OFF: {
    label: "Finalizado en destino",
    tone: "border-cyan-500 bg-cyan-50 text-cyan-700",
    panel: "",
  },
  COMPLETED: {
    label: "Viaje completado",
    tone: "border-emerald-500 bg-emerald-50 text-emerald-700",
    panel: "",
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
  const autoLoginRef = useRef(false);
  const [userCode, setUserCode] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [accessRequestStatus, setAccessRequestStatus] = useState<string | null>(null);
  const [accessRequestError, setAccessRequestError] = useState<string | null>(null);
  const [requestAccessLoading, setRequestAccessLoading] = useState(false);

  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const notify = useNotifications();
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
      const validatedAthletes = filterValidatedAthletes(athleteList || []);
      const match = validatedAthletes.find((item) => item.id?.slice(-6) === normalized);
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

  useEffect(() => {
    if (autoLoginRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const athleteId = params.get("athleteId");
    if (!athleteId) return;
    autoLoginRef.current = true;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<Athlete>(`/athletes/${athleteId}`);
        if (data) {
          setAthlete(data);
          setActiveTab("request");
          await loadPortal(data);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

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
        destination: [venue?.address, venue?.commune, venue?.region, "Chile"].filter(Boolean).join(", ") || venue?.name || "Sede solicitada",
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

  const activeChatTrip = useMemo(() =>
    trips.find((trip) => ["SCHEDULED", "EN_ROUTE", "PICKED_UP"].includes(trip.status || "")) || null,
  [trips]);

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

  // Poll active trips every 5s for status changes + notifications
  const prevStatuses = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!athlete) return;
    // Initialize status tracking
    trips.forEach((t) => {
      if (t.id && t.status) prevStatuses.current[t.id] = t.status;
    });

    const pollTrips = async () => {
      try {
        const tripData = await apiFetch<Trip[]>("/trips");
        const myTrips = (tripData || [])
          .filter(
            (trip) =>
              (trip.requesterAthleteId && trip.requesterAthleteId === athlete.id) ||
              (trip.athleteIds || []).includes(athlete.id),
          )
          .sort(
            (a, b) =>
              new Date(b.requestedAt || b.createdAt || 0).getTime() -
              new Date(a.requestedAt || a.createdAt || 0).getTime(),
          );

        // Detect status changes and notify
        myTrips.forEach((t) => {
          const prev = prevStatuses.current[t.id];
          if (prev && t.status && prev !== t.status) {
            const msgs: Record<string, { message: string; emoji: string }> = {
              SCHEDULED: { message: "Tu traslado fue programado", emoji: "📅" },
              EN_ROUTE: { message: "El conductor está en camino", emoji: "🚗" },
              PICKED_UP: { message: "Estás en ruta a tu destino", emoji: "✅" },
              COMPLETED: { message: "Viaje completado", emoji: "🎉" },
            };
            const info = msgs[t.status];
            if (info) notify.push(info.message, info.emoji);
          }
          if (t.id && t.status) prevStatuses.current[t.id] = t.status;
        });

        setTrips(myTrips);
      } catch { /* silent */ }
    };

    const timer = window.setInterval(pollTrips, 5000);
    return () => window.clearInterval(timer);
  }, [athlete?.id]);

  useEffect(() => {
    if (activeTab !== "status") return;
    setVisibleTripsCount(5);
  }, [activeTab, athlete?.id]);

  return (
    <>
      {!athlete && (
        <div className="flex flex-col lg:flex-row" style={{ minHeight: "100vh", background: "#020c18", position: "relative", overflow: "hidden" }}>
          <style>{`
            @keyframes pvr-f1{0%,100%{transform:translateY(0px) scale(1)}50%{transform:translateY(-30px) translateX(10px) scale(1.05)}}
            @keyframes pvr-f2{0%,100%{transform:translateY(0px)}50%{transform:translateY(-20px) translateX(15px)}}
            @keyframes pvr-pulse{0%,100%{opacity:0.15;transform:scale(1)}50%{opacity:0.4;transform:scale(1.08)}}
            @keyframes pvr-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
            @keyframes pvr-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
            .pvr-form{animation:pvr-in 0.6s cubic-bezier(0.16,1,0.3,1) both;animation-delay:0.15s;opacity:0;}
          `}</style>

          {/* Left branding panel */}
          <div className="flex flex-col justify-between p-8 lg:p-14 lg:w-[46%] lg:flex-shrink-0"
            style={{ background: "linear-gradient(160deg,#020c18 0%,#041a2e 40%,#062240 70%,#030f1e 100%)", position: "relative", overflow: "hidden", minHeight: "180px" }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: `linear-gradient(rgba(33,208,179,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.03) 1px,transparent 1px)`, backgroundSize: "60px 60px" }} />
            <div style={{ position: "absolute", top: "-60px", left: "-60px", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(6,34,64,0.6) 0%,transparent 70%)", animation: "pvr-f1 12s ease-in-out infinite", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "60px", right: "-40px", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(33,208,179,0.1) 0%,transparent 70%)", animation: "pvr-f2 16s ease-in-out infinite", pointerEvents: "none" }} />
            {[480, 340, 200].map((size, i) => (
              <div key={i} style={{ position: "absolute", top: "50%", left: "50%", marginTop: -size / 2, marginLeft: -size / 2, width: size, height: size, borderRadius: "50%", border: `1px solid rgba(33,208,179,${0.04 + i * 0.04})`, animation: `pvr-pulse 6s ease-in-out infinite ${i * 2}s`, pointerEvents: "none" }} />
            ))}
            <div style={{ position: "relative", zIndex: 1 }}>
              <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" className="h-14 sm:h-20 lg:h-28" style={{ width: "auto", objectFit: "contain", filter: "drop-shadow(0 0 30px rgba(33,208,179,0.4)) drop-shadow(0 4px 12px rgba(0,0,0,0.9))" }} />
            </div>
            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "16px", padding: "24px 0" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#21D0B3", boxShadow: "0 0 8px #21D0B3" }} />
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#21D0B3" }}>Portal de Movilidad</span>
              </div>
              <h1 style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 700, lineHeight: 1.1, color: "#ffffff", margin: 0 }}>
                Solicita tu<br />
                <span style={{ background: "linear-gradient(90deg,#21D0B3,#34F3C6,#21D0B3)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "pvr-shimmer 4s linear infinite" }}>
                  vehículo
                </span>
              </h1>
              <p className="hidden sm:block" style={{ fontSize: "15px", lineHeight: 1.6, color: "rgba(255,255,255,0.55)", maxWidth: "340px", margin: 0 }}>
                Registra, modifica y haz seguimiento en tiempo real de tus solicitudes de transporte hacia las sedes del evento.
              </p>
              <div className="hidden lg:flex flex-col" style={{ gap: "10px", marginTop: "8px" }}>
                {([
                  [<svg key="car" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(33,208,179,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>, "Solicita tu traslado"],
                  [<svg key="clock" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(33,208,179,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, "Seguimiento en tiempo real"],
                  [<svg key="pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(33,208,179,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, "Hacia las sedes del evento"],
                ] as [React.ReactNode, string][]).map(([icon, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden lg:block" style={{ position: "relative", zIndex: 1 }}>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em" }}>© Seven Arena · Portal seguro</p>
            </div>
          </div>

          {/* Right login panel */}
          <div className="pvr-form flex flex-1 flex-col justify-center px-5 py-8 sm:px-6 sm:py-12 lg:px-14" style={{ background: "linear-gradient(160deg,#030f1e 0%,#041a2e 50%,#020c18 100%)" }}>
            <div style={{ maxWidth: 480, width: "100%", margin: "0 auto" }}>
              <div style={{ marginBottom: "32px" }}>
                <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "8px" }}>Acceso</p>
                <h2 style={{ fontSize: "26px", fontWeight: 700, color: "#ffffff", margin: "0 0 6px" }}>Ingresa con tu código</h2>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", margin: 0 }}>Usa el código corto del portal de usuario para acceder a tu panel de movilidad.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "28px" }}>
                <input
                  className="input h-12 text-base"
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value)}
                  placeholder="Código de usuario"
                  onKeyDown={(e) => e.key === "Enter" && login()}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(33,208,179,0.2)", color: "#ffffff", borderRadius: "12px" }}
                />
                <button
                  type="button"
                  onClick={login}
                  disabled={loading}
                  style={{ height: "48px", borderRadius: "12px", fontWeight: 700, fontSize: "15px", cursor: loading ? "not-allowed" : "pointer", background: "linear-gradient(135deg,#34F3C6 0%,#21D0B3 50%,#15B09A 100%)", color: "#0d1b3e", border: "none", opacity: loading ? 0.7 : 1, boxShadow: "0 4px 20px rgba(33,208,179,0.35)" }}
                >
                  {loading ? "Ingresando…" : "Abrir portal"}
                </button>
                {error && <p style={{ fontSize: "13px", color: "#f87171", margin: 0 }}>{error}</p>}
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "28px" }}>
                <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "8px" }}>Recuperación de acceso</p>
                <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#ffffff", margin: "0 0 6px" }}>Solicita tu código</h3>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>
                  Si no tienes tu código, ingrésalo con tu correo registrado y te lo enviamos.
                </p>
                <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
                  <input
                    className="input h-11 text-sm"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    placeholder="email@dominio.com"
                    type="email"
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#ffffff", borderRadius: "10px" }}
                  />
                  <button
                    type="button"
                    onClick={requestAccess}
                    disabled={requestAccessLoading}
                    style={{ width: "100%", height: "44px", padding: "0 20px", borderRadius: "10px", fontWeight: 500, fontSize: "13px", cursor: requestAccessLoading ? "not-allowed" : "pointer", background: "rgba(33,208,179,0.1)", color: "#21D0B3", border: "1px solid rgba(33,208,179,0.3)", opacity: requestAccessLoading ? 0.7 : 1 }}
                  >
                    {requestAccessLoading ? "Enviando…" : "Solicitar código"}
                  </button>
                </div>
                {accessRequestStatus && <p style={{ fontSize: "13px", color: "#34d399", marginTop: "10px" }}>{accessRequestStatus}</p>}
                {accessRequestError && <p style={{ fontSize: "13px", color: "#f87171", marginTop: "10px" }}>{accessRequestError}</p>}

                <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
                  {[["Paso 1", "Solicita tu código"], ["Paso 2", "Ingresa al portal"], ["Paso 3", "Sigue el viaje"]].map(([step, label]) => (
                    <div key={step} style={{ borderRadius: "12px", padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(33,208,179,0.12)" }}>
                      <div style={{ fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(33,208,179,0.7)", marginBottom: "6px" }}>{step}</div>
                      <p style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.7)", margin: 0 }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {athlete && (
        <div style={{ minHeight:"100vh",background:"#eef1f8",position:"relative",overflow:"hidden" }}>
          <style>{`
            @keyframes vr-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
            @keyframes vr-glow{0%,100%{opacity:0.4}50%{opacity:0.8}}
            .vr-card{animation:vr-in .5s cubic-bezier(0.16,1,0.3,1) both;background:#fff;border:1px solid rgba(226,232,240,0.8);border-radius:18px;padding:16px;position:relative;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.04);}
            .vr-card:hover{box-shadow:0 6px 24px rgba(33,208,179,0.12);border-color:rgba(33,208,179,0.25);}
            @media(min-width:641px){.vr-card{border-radius:24px;padding:24px;}}
          `}</style>
          {/* Decorative bg */}
          <div style={{ position:"fixed",top:"-100px",right:"-100px",width:"400px",height:"400px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.06) 0%,transparent 65%)",pointerEvents:"none",zIndex:0 }} />

          {/* Banner */}
          <div style={{ position:"relative",background:"linear-gradient(135deg,#041a2e 0%,#062240 45%,#0a3356 80%,#041a2e 100%)",overflow:"hidden",zIndex:1 }}>
            <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(33,208,179,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.04) 1px,transparent 1px)",backgroundSize:"48px 48px",pointerEvents:"none" }} />
            <div style={{ position:"absolute",bottom:"-1px",left:0,right:0,height:"2px",background:"linear-gradient(90deg,transparent,#21D0B3 30%,#34F3C6 50%,#21D0B3 70%,transparent)",pointerEvents:"none",animation:"vr-glow 3s ease-in-out infinite" }} />
            <div style={{ padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",maxWidth:"960px",margin:"0 auto",position:"relative",zIndex:1 }}>
              <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" style={{ height:"34px",width:"auto",objectFit:"contain",filter:"drop-shadow(0 0 18px rgba(33,208,179,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.8))" }} />
              <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                <div style={{ width:6,height:6,borderRadius:"50%",background:"#21D0B3",boxShadow:"0 0 8px #21D0B3",animation:"vr-glow 2s ease-in-out infinite",flexShrink:0 }} />
                <span style={{ fontSize:"8px",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(33,208,179,0.9)" }}>Portal Movilidad</span>
              </div>
            </div>
          </div>

          <div style={{ maxWidth:"960px",margin:"0 auto",padding:"14px 10px 48px",position:"relative",zIndex:1 }}>

          {/* Profile card */}
          <div className="vr-card" style={{ marginBottom:"12px",display:"flex",flexDirection:"column",gap:"12px",borderLeft:"4px solid #21D0B3" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px" }}>
              <div style={{ display:"flex",alignItems:"center",gap:"12px",minWidth:0 }}>
                <div style={{ width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#21D0B3,#062240)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",fontWeight:900,color:"#fff",boxShadow:"0 3px 12px rgba(33,208,179,0.3)",flexShrink:0 }}>
                  {(athlete.fullName || "?").split(" ").slice(0,2).map(w=>w[0]||"").join("").toUpperCase()}
                </div>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"#21D0B3",margin:"0 0 2px" }}>Sesión activa</p>
                  <h2 style={{ fontSize:"17px",fontWeight:800,color:"#0f172a",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{athlete.fullName || athlete.id}</h2>
                </div>
              </div>
              <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                <NotificationBell
                  notifications={notify.notifications}
                  unreadCount={notify.unreadCount}
                  onMarkAllRead={notify.markAllRead}
                  onClear={notify.clear}
                />
                <button type="button" onClick={logout} style={{ display:"flex",alignItems:"center",gap:"6px",padding:"8px 12px",borderRadius:"10px",border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:"11px",fontWeight:600,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap" }}>
                  Salir
                </button>
              </div>
            </div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:"6px" }}>
              <span style={{ fontSize:"10px",fontWeight:600,padding:"3px 10px",borderRadius:"14px",background:"linear-gradient(135deg,rgba(33,208,179,0.12),rgba(33,208,179,0.06))",color:"#0a7a6b",border:"1px solid rgba(33,208,179,0.3)" }}>
                {events[athlete.eventId || ""]?.name || "-"}
              </span>
              <span style={{ fontSize:"10px",fontWeight:600,padding:"3px 10px",borderRadius:"14px",background:"#f1f5f9",color:"#334155",border:"1px solid #dde3ed" }}>
                {delegations[athlete.delegationId || ""]?.countryCode || "-"}
              </span>
            </div>
            {/* Stats row */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"6px" }}>
              {([
                { label:"Solicit.", value:requestStats.requested, color:"#0f172a" },
                { label:"Program.", value:requestStats.scheduled, color:"#21D0B3" },
                { label:"Activas", value:requestStats.active, color:"#f59e0b" },
                { label:"Cerradas", value:requestStats.completed, color:"#10b981" },
              ] as const).map(s => (
                <div key={s.label} style={{ textAlign:"center",padding:"8px 4px",borderRadius:"10px",background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                  <div style={{ fontSize:"8px",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#94a3b8" }}>{s.label}</div>
                  <div style={{ fontSize:"20px",fontWeight:700,color:s.color,marginTop:"2px" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          <section style={{ display:"flex",flexDirection:"column",gap:"12px" }}>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px" }}>
              {([
                { key:"request" as PortalTab, label:"Solicitar", sub:"Nuevo viaje" },
                { key:"status" as PortalTab, label:"Estado", sub:"Mis solicitudes" },
              ]).map(tab => (
                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding:"12px 14px",borderRadius:"14px",textAlign:"left",cursor:"pointer",transition:"all .2s",border:"none",
                    background: activeTab===tab.key ? "linear-gradient(135deg,#041a2e,#062240)" : "#fff",
                    boxShadow: activeTab===tab.key ? "0 4px 16px rgba(33,208,179,0.2)" : "0 1px 6px rgba(0,0,0,0.04)",
                  }}>
                  <div style={{ fontSize:"9px",fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:activeTab===tab.key?"#21D0B3":"#94a3b8" }}>{tab.label}</div>
                  <div style={{ fontSize:"14px",fontWeight:700,color:activeTab===tab.key?"#fff":"#0f172a",marginTop:"4px" }}>{tab.sub}</div>
                </button>
              ))}
            </div>

            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            {activeTab === "request" ? (
              <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr] xl:gap-6">
                <div className="vr-card">
                  <p style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"#21D0B3",margin:"0 0 4px" }}>Nueva solicitud</p>
                  <h3 style={{ fontSize:"18px",fontWeight:800,color:"#0f172a",margin:"0 0 4px" }}>
                    {editingTripId ? "Modificar solicitud" : "Pedir vehiculo"}
                  </h3>
                  {editingTrip ? (
                    <div className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ border: "1px solid var(--warning-border)", background: "var(--warning-dim)", color: "var(--warning)" }}>
                      Editable hasta las <strong>{formatDateTime(getEditDeadline(editingTrip)?.toISOString() || null)}</strong>.
                    </div>
                  ) : null}

                  <form className="mt-6 space-y-4" onSubmit={submitRequest}>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Tipo de vehiculo</span>
                      <select className="input h-12 text-base" value={selectedVehicleType} onChange={(e) => setSelectedVehicleType(e.target.value)}>
                        {VEHICLE_TYPES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Direccion de origen</span>
                      <PlacesAutocompleteInput
                        className="input h-12 text-base"
                        value={originAddress}
                        onChange={setOriginAddress}
                        placeholder="Ej: Aeropuerto Internacional de Santiago"
                      />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Escribe y selecciona la dirección exacta donde debe recogerte el conductor.
                      </span>
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Sede destino</span>
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
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Hora del servicio</span>
                      <input
                        className="input h-12 w-full text-base"
                        type="datetime-local"
                        value={requestedTime}
                        onChange={(e) => setRequestedTime(e.target.value)}
                      />
                    </label>
                    <label className="block max-w-[220px] space-y-2">
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Cantidad de personas</span>
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
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Observaciones operativas</span>
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
                </div>

                <div className="vr-card hidden xl:block">
                  <p style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"#21D0B3",margin:"0 0 4px" }}>Vista previa</p>
                  <h3 className="mt-2 text-3xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Resumen del servicio</h3>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                      <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Solicitante</div>
                      <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>{athlete.fullName || athlete.id}</div>
                    </div>
                    <div className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                      <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Tipo requerido</div>
                      <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>{vehicleTypeLabel(selectedVehicleType)}</div>
                    </div>
                    <div className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                      <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Programacion</div>
                      <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>
                        {requestedTime ? formatDateTime(new Date(requestedTime).toISOString()) : "Selecciona hora"}
                      </div>
                    </div>
                    <div className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                      <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Personas</div>
                      <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>{passengerCount || "1"}</div>
                    </div>
                    <div className="rounded-2xl p-4 sm:col-span-2" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                      <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Origen</div>
                      <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>{originAddress || "Ingresa direccion de origen"}</div>
                    </div>
                    <div className="rounded-2xl p-4 sm:col-span-2" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                      <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Sede</div>
                      <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>{selectedVenue?.name || "Selecciona una sede"}</div>
                      <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>{venueSummary(selectedVenue)}</p>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section style={{ display:"flex",flexDirection:"column",gap:"12px" }}>
                {trips.length === 0 ? (
                  <div className="vr-card" style={{ textAlign:"center",padding:"32px 16px",border:"1px dashed rgba(33,208,179,0.3)" }}>
                    <p style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"#94a3b8",margin:"0 0 8px" }}>Estado de servicio</p>
                    <h3 style={{ fontSize:"18px",fontWeight:800,color:"#0f172a",margin:"0 0 6px" }}>Aún no tienes solicitudes</h3>
                    <p style={{ fontSize:"13px",color:"#64748b",margin:0,lineHeight:1.5 }}>
                      Cuando registres una solicitud, aquí verás su estado y datos del vehículo.
                    </p>
                  </div>
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
                      <div
                        key={trip.id}
                        className="vr-card"
                      >
                        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px" }}>
                          <div style={{ minWidth:0 }}>
                            <p style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"#94a3b8",margin:"0 0 4px" }}>Solicitud {trip.id.slice(0, 8)}</p>
                            <h3 style={{ fontSize:"16px",fontWeight:800,color:"#0f172a",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                              {venue?.name || trip.destination || "Destino solicitado"}
                            </h3>
                            <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                              {vehicleTypeLabel(trip.requestedVehicleType)} solicitado el {formatDateTime(trip.requestedAt || trip.createdAt)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ border: "1px solid var(--border-strong)", background: "var(--elevated)", color: "var(--text)" }}>{status.label}</span>
                            {editable ? (
                              <button className="btn btn-ghost h-10 px-4 text-sm" type="button" onClick={() => startEditingTrip(trip)}>
                                Modificar solicitud
                              </button>
                            ) : null}
                            {editable ? (
                              <button className="btn btn-ghost h-10 px-4 text-sm text-rose-600" type="button" onClick={() => cancelTrip(trip)}>
                                Cancelar solicitud
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                              <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Sede destino</div>
                              <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>{venue?.name || "Pendiente"}</div>
                              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>{venueSummary(venue)}</p>
                            </div>
                            <div className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                              <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Programacion</div>
                              <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>{formatDateTime(trip.scheduledAt)}</div>
                              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>Origen: {trip.origin || "Pendiente"}</p>
                            </div>
                            <div className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                              <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Personas</div>
                              <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>{trip.passengerCount || "-"}</div>
                              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>Capacidad requerida para el servicio</p>
                            </div>
                            <div className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                              <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Chofer asignado</div>
                              <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>{driver?.fullName || "Pendiente de asignacion"}</div>
                              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>{driver?.phone || "Telefono aun no disponible"}</p>
                            </div>
                            <div className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                              <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Vehiculo</div>
                              <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>{vehicle?.plate || "Pendiente"}</div>
                              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                                {[vehicle?.type, vehicle?.brand, vehicle?.model].filter(Boolean).join(" · ") || "Aun sin datos de unidad"}
                              </p>
                            </div>
                            {trip.status === "EN_ROUTE" || trip.status === "PICKED_UP" ? (
                              <div className="rounded-2xl p-4 sm:col-span-2" style={{ border: "1px solid var(--success-border)", background: "var(--success-dim)" }}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--success)" }}>Seguimiento en vivo</div>
                                    <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>
                                      {trip.status === "PICKED_UP" ? "Tu viaje esta en curso" : "Tu conductor va en camino"}
                                    </div>
                                    <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
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
                                <div className="mt-4 overflow-hidden rounded-2xl" style={{ border: "1px solid var(--success-border)", background: "var(--surface)" }}>
                                  {coords && mapEmbedUrl ? (
                                    <iframe
                                      title={`live-map-${trip.id}`}
                                      src={mapEmbedUrl}
                                      className="h-64 w-full"
                                      loading="lazy"
                                    />
                                  ) : coords ? (
                                    <div className="flex h-64 items-center justify-center px-6 text-center text-sm" style={{ background: "var(--elevated)", color: "var(--text-muted)" }}>
                                      Falta configurar <code className="mx-1 rounded px-1.5 py-0.5" style={{ background: "var(--border)", color: "var(--text)" }}>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> para mostrar el mapa en tiempo real.
                                    </div>
                                  ) : (
                                    <div className="flex h-64 items-center justify-center px-6 text-center text-sm" style={{ background: "var(--elevated)", color: "var(--text-muted)" }}>
                                      El mapa aparecera apenas el conductor comparta su posicion desde el portal.
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className="rounded-[26px] p-5" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                            <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Trazabilidad</div>
                            <div className="mt-4 space-y-3">
                              <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--surface)", color: "var(--text)" }}>
                                <strong>Estado actual:</strong> {status.label}
                              </div>
                              <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--surface)", color: "var(--text)" }}>
                                <strong>Creada:</strong> {formatDateTime(trip.requestedAt || trip.createdAt)}
                              </div>
                              <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--surface)", color: "var(--text)" }}>
                                <strong>Destino final:</strong> {trip.destination || venue?.name || "Pendiente"}
                              </div>
                              <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--surface)", color: "var(--text)" }}>
                                <strong>Observaciones:</strong> {trip.notes || "Sin observaciones registradas."}
                              </div>
                              <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--surface)", color: "var(--text)" }}>
                                <strong>Editable hasta:</strong>{" "}
                                {editDeadline ? formatDateTime(editDeadline.toISOString()) : "-"}
                              </div>
                              <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--surface)", color: "var(--text)" }}>
                                <strong>Ventana de cambios:</strong>{" "}
                                {editable
                                  ? "Activa para edicion y cancelacion."
                                  : "Cerrada. Ya esta dentro de las 2 horas previas al viaje."}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {trips.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] px-5 py-4 shadow-sm" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
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
          </div>
        </div>
      )}

      {/* Trip Chat */}
      {athlete && activeChatTrip && (
        <TripChat
          tripId={activeChatTrip.id}
          senderType="PASSENGER"
          senderName={athlete.fullName || "Pasajero"}
          onNewMessage={(name, content) => notify.push(`${name}: ${content.slice(0, 80)}`, "💬")}
        />
      )}
    </>
  );
}
