"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import PlacesAutocompleteInput from "@/components/PlacesAutocompleteInput";
import { apiFetch } from "@/lib/api";
import { getMobileSession, mobileAwareLogout } from "@/lib/mobile-auth";
import { filterValidatedAthletes } from "@/lib/athletes";
import NotificationBell, { useNotifications } from "@/components/NotificationBell";
import TripChat from "@/components/TripChat";
import dynamic from "next/dynamic";

const TripMap = dynamic(() => import("@/components/TripMap"), {
  ssr: false,
  loading: () => <div style={{ height: 200, background: "#eef2f6", borderRadius: 12 }} />,
});

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
  driverRating?: number | null;
  ratingComment?: string | null;
  ratedAt?: string | null;
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
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

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
  const [ratingTripId, setRatingTripId] = useState<string | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);

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

  const [bootCheckDone, setBootCheckDone] = useState(false);

  useEffect(() => {
    if (autoLoginRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const queryAthleteId = params.get("athleteId");
    const session = getMobileSession();
    const sessionAthleteId =
      session?.kind === "athlete" ? session.athleteId : null;
    const athleteId = queryAthleteId || sessionAthleteId;
    if (!athleteId) {
      setBootCheckDone(true);
      return;
    }
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
      } catch {} finally {
        setLoading(false);
        setBootCheckDone(true);
      }
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
    mobileAwareLogout();
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

  const dismissRating = () => {
    if (ratingTripId) ratingDismissed.current.add(ratingTripId);
    setRatingTripId(null);
    setRatingStars(0);
    setRatingComment("");
  };

  const submitRating = async (tripId: string) => {
    if (ratingStars === 0) return;
    setRatingLoading(true);
    try {
      await apiFetch(`/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverRating: ratingStars,
          ratingComment: ratingComment.trim() || undefined,
          ratedAt: new Date().toISOString(),
        }),
      });
      setTrips((prev) => prev.map((t) => t.id === tripId ? { ...t, driverRating: ratingStars } : t));
      notify.push("¡Gracias por tu evaluación!", "⭐");
      setRatingTripId(null);
      setRatingStars(0);
      setRatingComment("");
    } catch {
      notify.push("No se pudo enviar la evaluación", "❌");
    } finally {
      setRatingLoading(false);
    }
  };

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

  // Auto-show rating popup when a trip transitions to completed
  const ratingDismissed = useRef<Set<string>>(new Set());
  const prevTripStatuses = useRef<Record<string, string>>({});
  useEffect(() => {
    trips.forEach((t) => {
      const prev = prevTripStatuses.current[t.id];
      const isNewCompletion = prev && prev !== t.status && (t.status === "COMPLETED" || t.status === "DROPPED_OFF");
      if (isNewCompletion && !t.driverRating && t.driverId && !ratingDismissed.current.has(t.id)) {
        setRatingTripId(t.id);
      }
      if (t.id && t.status) prevTripStatuses.current[t.id] = t.status;
    });
  }, [trips]);

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
            // Auto-open rating when trip completes
            if ((t.status === "COMPLETED" || t.status === "DROPPED_OFF") && !t.driverRating && t.driverId) {
              setRatingTripId(t.id);
              setExpandedTripId(t.id);
            }
          }
          if (t.id && t.status) prevStatuses.current[t.id] = t.status;
        });

        setTrips(myTrips);
      } catch { /* silent */ }
    };

    const timer = window.setInterval(pollTrips, 5000);
    return () => window.clearInterval(timer);
  }, [athlete?.id]);

  // User geolocation + send to backend (Safari-friendly)
  useEffect(() => {
    if (!athlete || !navigator.geolocation) return;
    let cleared = false;
    let watchId: number | null = null;
    let fallbackInterval: number | null = null;
    let gotPosition = false;

    const onPos = (pos: GeolocationPosition) => {
      gotPosition = true;
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserPos(coords);
      if (activeChatTrip?.id && ["EN_ROUTE", "PICKED_UP"].includes(activeChatTrip.status ?? "")) {
        apiFetch(`/trips/${activeChatTrip.id}/passenger-position`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coords),
        }).catch(() => {});
      }
    };
    const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 };

    navigator.geolocation.getCurrentPosition(onPos, () => {}, opts);
    watchId = navigator.geolocation.watchPosition(onPos, () => {}, opts);

    // Safari fallback: poll if watchPosition doesn't fire
    setTimeout(() => {
      if (!gotPosition && !cleared) {
        fallbackInterval = window.setInterval(() => {
          navigator.geolocation.getCurrentPosition(onPos, () => {}, { enableHighAccuracy: false, maximumAge: 15000, timeout: 20000 });
        }, 5000);
      }
    }, 10000);

    return () => {
      cleared = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (fallbackInterval) window.clearInterval(fallbackInterval);
    };
  }, [athlete?.id, activeChatTrip?.id, activeChatTrip?.status]);

  useEffect(() => {
    if (activeTab !== "status") return;
    setVisibleTripsCount(5);
  }, [activeTab, athlete?.id]);

  return (
    <>
      {!athlete && !bootCheckDone && (
        <div style={{ minHeight: "100vh", background: "#020c18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(33,208,179,0.25)", borderTopColor: "#21D0B3", animation: "pvr-spin 0.8s linear infinite" }} />
          <style>{`@keyframes pvr-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      {!athlete && bootCheckDone && (
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
            @keyframes vrPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}
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
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <NotificationBell
                  notifications={notify.notifications}
                  unreadCount={notify.unreadCount}
                  onMarkAllRead={notify.markAllRead}
                  onClear={notify.clear}
                />
                <button type="button" onClick={() => athlete && loadPortal(athlete)} disabled={loading}
                  style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:10,border:"1px solid rgba(33,208,179,0.4)",background:"rgba(33,208,179,0.12)",cursor:"pointer",flexShrink:0,opacity:loading?0.5:1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                </button>
                <button type="button" onClick={logout}
                  style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:10,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.08)",cursor:"pointer",flexShrink:0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div style={{ maxWidth:"960px",margin:"0 auto",padding:"14px 10px 48px",position:"relative",zIndex:1 }}>

          {/* Profile card */}
          <div className="vr-card" style={{ marginBottom:"12px",display:"flex",flexDirection:"column",gap:"10px",borderLeft:"4px solid #21D0B3" }}>
            <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
              <div style={{ width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#21D0B3,#062240)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:900,color:"#fff",boxShadow:"0 3px 12px rgba(33,208,179,0.3)",flexShrink:0 }}>
                {(athlete.fullName || "?").split(" ").slice(0,2).map(w=>w[0]||"").join("").toUpperCase()}
              </div>
              <div style={{ minWidth:0,flex:1 }}>
                <h2 style={{ fontSize:"15px",fontWeight:800,color:"#0f172a",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{athlete.fullName || athlete.id}</h2>
                <div style={{ display:"flex",flexWrap:"wrap",gap:"4px",marginTop:3 }}>
                  <span style={{ fontSize:"9px",fontWeight:600,padding:"2px 8px",borderRadius:"10px",background:"linear-gradient(135deg,rgba(33,208,179,0.12),rgba(33,208,179,0.06))",color:"#0a7a6b",border:"1px solid rgba(33,208,179,0.3)" }}>
                    {events[athlete.eventId || ""]?.name || "-"}
                  </span>
                  <span style={{ fontSize:"9px",fontWeight:600,padding:"2px 8px",borderRadius:"10px",background:"#f1f5f9",color:"#334155",border:"1px solid #dde3ed" }}>
                    {delegations[athlete.delegationId || ""]?.countryCode || "-"}
                  </span>
                </div>
              </div>
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
              <section>
                <div style={{ borderRadius:16,border:"1px solid #e2e8f0",background:"#fff",padding:"16px 14px",boxShadow:"0 1px 4px rgba(15,23,42,0.04)" }}>
                  <p style={{ fontSize:14,fontWeight:700,color:"#0f172a",margin:"0 0 12px" }}>
                    {editingTripId ? "Modificar solicitud" : "Solicitar vehículo"}
                  </p>
                  {editingTrip ? (
                    <div style={{ padding:"8px 10px",borderRadius:10,background:"#fffbeb",border:"1px solid #fde68a",color:"#92400e",fontSize:12,marginBottom:12 }}>
                      Editable hasta <strong>{formatDateTime(getEditDeadline(editingTrip)?.toISOString() || null)}</strong>
                    </div>
                  ) : null}

                  <form onSubmit={submitRequest} style={{ display:"flex",flexDirection:"column",gap:10 }}>
                    {/* Row: tipo + personas */}
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 90px",gap:8 }}>
                      <div>
                        <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Tipo de vehículo</label>
                        <select className="input" value={selectedVehicleType} onChange={(e) => setSelectedVehicleType(e.target.value)}
                          style={{ width:"100%",height:40,fontSize:13,borderRadius:10 }}>
                          {VEHICLE_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Personas</label>
                        <input className="input" type="number" min={1} step={1} value={passengerCount}
                          onChange={(e) => setPassengerCount(e.target.value)}
                          style={{ width:"100%",height:40,fontSize:13,borderRadius:10,textAlign:"center" }} />
                      </div>
                    </div>

                    {/* Origen */}
                    <div>
                      <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Origen</label>
                      <PlacesAutocompleteInput
                        className="input"
                        value={originAddress}
                        onChange={setOriginAddress}
                        placeholder="Dirección de recogida"
                        style={{ height:40,fontSize:13,borderRadius:10 }}
                      />
                    </div>

                    {/* Sede destino */}
                    <div>
                      <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Sede destino</label>
                      <select className="input" value={selectedVenueId} onChange={(e) => setSelectedVenueId(e.target.value)}
                        style={{ width:"100%",height:40,fontSize:13,borderRadius:10 }}>
                        <option value="">Selecciona una sede</option>
                        {venues.map((venue) => (
                          <option key={venue.id} value={venue.id}>
                            {venue.name}{venue.address ? ` — ${venue.address}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Hora */}
                    <div>
                      <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Fecha y hora</label>
                      <input className="input" type="datetime-local" value={requestedTime}
                        onChange={(e) => setRequestedTime(e.target.value)}
                        style={{ width:"100%",height:40,fontSize:13,borderRadius:10 }} />
                    </div>

                    {/* Notas (colapsable) */}
                    <div>
                      <label style={{ fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3,display:"block" }}>Notas (opcional)</label>
                      <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)}
                        placeholder="Equipamiento, prioridad, indicaciones..."
                        rows={2}
                        style={{ width:"100%",fontSize:13,borderRadius:10,resize:"none",padding:"8px 10px",boxSizing:"border-box",fontFamily:"inherit" }} />
                    </div>

                    {/* Submit */}
                    <button type="submit" disabled={submitting}
                      style={{
                        width:"100%",height:42,borderRadius:12,border:"none",fontSize:14,fontWeight:700,cursor:"pointer",
                        background: submitting ? "#e2e8f0" : "linear-gradient(135deg,#21D0B3,#14AE98)",
                        color: submitting ? "#94a3b8" : "#fff",
                        boxShadow: submitting ? "none" : "0 2px 10px rgba(33,208,179,0.3)",
                      }}>
                      {submitting
                        ? (editingTripId ? "Guardando..." : "Enviando...")
                        : (editingTripId ? "Guardar cambios" : "Enviar solicitud")}
                    </button>
                    {editingTripId && (
                      <button type="button" onClick={resetRequestForm}
                        style={{ width:"100%",height:38,borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                        Cancelar
                      </button>
                    )}
                  </form>
                </div>
              </section>
            ) : (
              <section style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
                {trips.length === 0 ? (
                  <div style={{ textAlign:"center",padding:"28px 16px",borderRadius:16,border:"1px dashed rgba(33,208,179,0.3)",background:"#fafcfb" }}>
                    <p style={{ fontSize:"15px",fontWeight:700,color:"#0f172a",margin:"0 0 4px" }}>Sin solicitudes</p>
                    <p style={{ fontSize:"12.5px",color:"#64748b",margin:0 }}>Tus solicitudes de vehículo aparecerán aquí.</p>
                  </div>
                ) : (
                  visibleTrips.map((trip) => {
                    const venue = venues.find((item) => item.id === trip.destinationVenueId);
                    const driver = trip.driverId ? drivers[trip.driverId] : null;
                    const vehicle = trip.vehicleId ? vehicles[trip.vehicleId] : null;
                    const status = statusMeta[trip.status || "REQUESTED"] || statusMeta.REQUESTED;
                    const editable = canEditTrip(trip);
                    const isExpanded = expandedTripId === trip.id;
                    const isActive = trip.status === "EN_ROUTE" || trip.status === "PICKED_UP";
                    const isCompleted = trip.status === "COMPLETED" || trip.status === "DROPPED_OFF";
                    const canRate = isCompleted && !trip.driverRating && trip.driverId;
                    const livePosition = trip.vehicleId ? positionsByVehicle[trip.vehicleId] : null;
                    const coords = extractCoords(livePosition);

                    return (
                      <div key={trip.id} style={{
                        borderRadius:16,border:"1px solid #e2e8f0",background:"#fff",
                        overflow:"hidden",boxShadow:"0 1px 4px rgba(15,23,42,0.04)",
                      }}>
                        {/* ── Compact header (always visible) ── */}
                        <button
                          type="button"
                          onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                          style={{
                            width:"100%",display:"flex",alignItems:"center",gap:10,
                            padding:"12px 14px",background:"none",border:"none",cursor:"pointer",
                            textAlign:"left",
                          }}
                        >
                          {/* Status dot */}
                          <span style={{
                            width:10,height:10,borderRadius:"50%",flexShrink:0,
                            background: isActive ? "#7c3aed" : isCompleted ? "#21D0B3" : trip.status === "SCHEDULED" ? "#0ea5e9" : "#f59e0b",
                            boxShadow: isActive ? "0 0 8px rgba(124,58,237,0.4)" : "none",
                          }} />
                          <div style={{ flex:1,minWidth:0 }}>
                            <p style={{ fontSize:13.5,fontWeight:700,color:"#0f172a",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                              {venue?.name || trip.destination || "Destino pendiente"}
                            </p>
                            <p style={{ fontSize:11,color:"#94a3b8",margin:"2px 0 0" }}>
                              {formatDateTime(trip.scheduledAt || trip.requestedAt)} · {status.label}
                            </p>
                          </div>
                          {/* Driver + vehicle chips */}
                          {driver && (
                            <span style={{ fontSize:10.5,fontWeight:600,padding:"3px 8px",borderRadius:8,background:"#f1f5f9",color:"#334155",whiteSpace:"nowrap",flexShrink:0 }}>
                              {driver.fullName}
                            </span>
                          )}
                          {/* Expand arrow */}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0,transition:"transform .2s",transform:isExpanded?"rotate(180deg)":"rotate(0)" }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {/* ── Active trip banner ── */}
                        {isActive && !isExpanded && (
                          <div style={{ padding:"0 14px 10px",display:"flex",alignItems:"center",gap:8 }}>
                            <span style={{ width:6,height:6,borderRadius:"50%",background:"#7c3aed",animation:"vrPulse 1.5s ease-in-out infinite" }} />
                            <span style={{ fontSize:12,fontWeight:600,color:"#7c3aed" }}>
                              {trip.status === "PICKED_UP" ? "Viaje en curso" : trip.status === "EN_ROUTE" ? "Conductor en camino" : ""}
                            </span>
                          </div>
                        )}

                        {/* ── Rate prompt (completed, no rating) ── */}
                        {canRate && !isExpanded && ratingTripId !== trip.id && (
                          <div style={{ padding:"0 14px 10px" }}>
                            <button type="button" onClick={() => setRatingTripId(trip.id)} style={{
                              display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:10,
                              border:"1px solid rgba(33,208,179,0.3)",background:"rgba(33,208,179,0.06)",
                              color:"#0a7a6b",fontSize:12,fontWeight:600,cursor:"pointer",
                            }}>
                              ⭐ Evaluar conductor
                            </button>
                          </div>
                        )}

                        {/* ── Rating stars (completed, no rating) ── */}
                        {isCompleted && !trip.driverRating && ratingTripId === trip.id && (
                          <div style={{ padding:"0 14px 14px",display:"flex",flexDirection:"column",alignItems:"center",gap:10 }}>
                            <p style={{ fontSize:13,fontWeight:600,color:"#0f172a",margin:0 }}>
                              ¿Cómo fue tu viaje?
                            </p>
                            <div style={{ display:"flex",gap:4 }}>
                              {[1,2,3,4,5].map((star) => (
                                <button key={star} type="button" onClick={() => setRatingStars(star)} style={{ background:"none",border:"none",cursor:"pointer",padding:2 }}>
                                  <svg width="32" height="32" viewBox="0 0 24 24" fill={ratingStars >= star ? "#FBBF24" : "none"} stroke={ratingStars >= star ? "#F59E0B" : "#CBD5E1"} strokeWidth="1.5">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                  </svg>
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={ratingComment}
                              onChange={(e) => setRatingComment(e.target.value)}
                              placeholder="Comentario opcional..."
                              rows={2}
                              style={{ width:"100%",padding:10,borderRadius:10,border:"1px solid #e2e8f0",fontSize:13,resize:"none",outline:"none",boxSizing:"border-box",fontFamily:"inherit" }}
                            />
                            <div style={{ display:"flex",gap:8,width:"100%" }}>
                              <button type="button" onClick={() => submitRating(trip.id)} disabled={ratingStars === 0 || ratingLoading}
                                style={{ flex:1,padding:10,borderRadius:10,border:"none",background:ratingStars > 0 ? "linear-gradient(135deg,#34F3C6,#21D0B3)" : "#e2e8f0",color:ratingStars > 0 ? "#0d1b3e" : "#94a3b8",fontSize:13,fontWeight:700,cursor:ratingStars > 0 ? "pointer" : "not-allowed" }}>
                                {ratingLoading ? "..." : "Enviar"}
                              </button>
                              <button type="button" onClick={() => { setRatingTripId(null); setRatingStars(0); setRatingComment(""); }}
                                style={{ padding:"10px 14px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                                Omitir
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ── Rating already given ── */}
                        {trip.driverRating && !isExpanded && (
                          <div style={{ padding:"0 14px 10px",display:"flex",alignItems:"center",gap:4 }}>
                            {Array.from({ length: trip.driverRating }, (_, i) => (
                              <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1.5">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            ))}
                            <span style={{ fontSize:11,color:"#94a3b8",marginLeft:4 }}>Evaluado</span>
                          </div>
                        )}

                        {/* ── Expanded details ── */}
                        {isExpanded && (
                          <div style={{ padding:"0 14px 14px",display:"flex",flexDirection:"column",gap:8 }}>
                            {/* Info rows */}
                            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Origen</p>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0",lineHeight:1.3 }}>{trip.origin || "Pendiente"}</p>
                              </div>
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Destino</p>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0",lineHeight:1.3 }}>{trip.destination || venue?.name || "Pendiente"}</p>
                              </div>
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Conductor</p>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{driver?.fullName || "Pendiente"}</p>
                                {driver?.phone && <p style={{ fontSize:11,color:"#64748b",margin:"2px 0 0" }}>{driver.phone}</p>}
                              </div>
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Vehículo</p>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{vehicle?.plate || "Pendiente"}</p>
                                {vehicle && <p style={{ fontSize:11,color:"#64748b",margin:"2px 0 0" }}>{[vehicle.type, vehicle.brand, vehicle.model].filter(Boolean).join(" · ")}</p>}
                              </div>
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Personas</p>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{trip.passengerCount || "-"}</p>
                              </div>
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Tipo</p>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:"3px 0 0" }}>{vehicleTypeLabel(trip.requestedVehicleType)}</p>
                              </div>
                            </div>
                            {trip.notes && (
                              <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                <p style={{ fontSize:10,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Notas</p>
                                <p style={{ fontSize:12.5,color:"#334155",margin:"3px 0 0",lineHeight:1.4 }}>{trip.notes}</p>
                              </div>
                            )}

                            {/* Map for scheduled and active trips */}
                            {(isActive || trip.status === "SCHEDULED") && (
                              <div style={{ borderRadius:12,overflow:"hidden",border:"1px solid rgba(33,208,179,0.25)" }}>
                                <TripMap
                                  origin={trip.origin}
                                  destination={trip.destination || venue?.name}
                                  driverPosition={coords ? { lat: coords.lat, lng: coords.lng } : null}
                                  userPosition={userPos || (trip.passengerLat && trip.passengerLng ? { lat: trip.passengerLat, lng: trip.passengerLng } : null)}
                                  height={200}
                                />
                                <div style={{ padding:"8px 10px",background:"rgba(33,208,179,0.06)",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                                  <span style={{ fontSize:12,fontWeight:700,color:"#0a7a6b" }}>
                                    {trip.status === "PICKED_UP" ? "🚗 Viaje en curso" : trip.status === "EN_ROUTE" ? "🚗 Conductor en camino" : "📍 Ruta programada"}
                                  </span>
                                  {coords && (
                                    <a
                                      href={buildDirectionsLink(coords.lat, coords.lng, trip.origin)}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ fontSize:11,color:"#21D0B3",fontWeight:600 }}
                                    >
                                      Abrir en Maps →
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Action buttons */}
                            {editable && (
                              <div style={{ display:"flex",gap:8,marginTop:4 }}>
                                <button type="button" onClick={() => startEditingTrip(trip)}
                                  style={{ flex:1,padding:"8px 12px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#334155",fontSize:12,fontWeight:600,cursor:"pointer" }}>
                                  Modificar
                                </button>
                                <button type="button" onClick={() => cancelTrip(trip)}
                                  style={{ padding:"8px 12px",borderRadius:10,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",fontSize:12,fontWeight:600,cursor:"pointer" }}>
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {trips.length > 0 && hasMoreTrips && (
                  <button
                    type="button"
                    onClick={() => setVisibleTripsCount((c) => c + 5)}
                    style={{ padding:"10px",borderRadius:12,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12.5,fontWeight:600,cursor:"pointer",textAlign:"center" }}
                  >
                    Ver más ({trips.length - visibleTripsCount} restantes)
                  </button>
                )}
              </section>
            )}
          </section>
          </div>
        </div>
      )}

      {/* Rating popup modal */}
      {ratingTripId && (() => {
        const rTrip = trips.find((t) => t.id === ratingTripId);
        if (!rTrip || rTrip.driverRating) return null;
        const rDriver = rTrip.driverId ? drivers[rTrip.driverId] : null;
        return (
          <div
            onClick={dismissRating}
            style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background:"#fff",borderRadius:20,padding:"28px 24px",maxWidth:340,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}
            >
              <p style={{ fontSize:32,margin:"0 0 4px" }}>
                {ratingStars === 0 ? "🚗" : ratingStars <= 2 ? "😕" : ratingStars <= 3 ? "🙂" : ratingStars <= 4 ? "😊" : "🤩"}
              </p>
              <p style={{ fontSize:16,fontWeight:700,color:"#0f172a",margin:"0 0 4px" }}>¿Cómo fue tu viaje?</p>
              {rDriver?.fullName && <p style={{ fontSize:13,color:"#64748b",margin:"0 0 16px" }}>Conductor: {rDriver.fullName}</p>}

              <div style={{ display:"flex",justifyContent:"center",gap:6,marginBottom:16 }}>
                {[1,2,3,4,5].map((star) => (
                  <button key={star} type="button" onClick={() => setRatingStars(star)}
                    style={{ background:"none",border:"none",cursor:"pointer",padding:3,transition:"transform .15s",transform:ratingStars >= star ? "scale(1.15)" : "scale(1)" }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill={ratingStars >= star ? "#FBBF24" : "none"} stroke={ratingStars >= star ? "#F59E0B" : "#CBD5E1"} strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                ))}
              </div>

              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Comentario opcional..."
                rows={2}
                style={{ width:"100%",padding:10,borderRadius:12,border:"1px solid #e2e8f0",fontSize:13,resize:"none",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:14 }}
              />

              <button type="button" onClick={() => submitRating(rTrip.id)} disabled={ratingStars === 0 || ratingLoading}
                style={{ width:"100%",padding:14,borderRadius:14,border:"none",background:ratingStars > 0 ? "linear-gradient(135deg,#34F3C6,#21D0B3)" : "#e2e8f0",color:ratingStars > 0 ? "#0d1b3e" : "#94a3b8",fontSize:15,fontWeight:700,cursor:ratingStars > 0 ? "pointer" : "not-allowed",opacity:ratingLoading ? 0.7 : 1 }}>
                {ratingLoading ? "Enviando..." : "Enviar evaluación"}
              </button>
              <button type="button" onClick={dismissRating}
                style={{ marginTop:8,background:"none",border:"none",color:"#94a3b8",fontSize:13,cursor:"pointer",padding:8 }}>
                Omitir
              </button>
            </div>
          </div>
        );
      })()}

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
