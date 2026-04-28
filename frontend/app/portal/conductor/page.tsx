"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { getMobileSession, mobileAwareLogout } from "@/lib/mobile-auth";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import NotificationBell, { useNotifications } from "@/components/NotificationBell";
import TripChat from "@/components/TripChat";
import AssistanceChat from "@/components/AssistanceChat";
import QRCode from "qrcode";
import { buildCredentialHtml } from "@/lib/credential-template";

const TripMap = dynamic(() => import("@/components/TripMap"), {
  ssr: false,
  loading: () => <div style={{ height: 240, background: "#dde8e2", borderRadius: "0" }} />,
});

type Trip = {
  id: string;
  driverId: string;
  eventId?: string | null;
  vehicleId: string;
  requesterAthleteId?: string | null;
  origin?: string | null;
  destination?: string | null;
  tripType?: string | null;
  tripCost?: number | null;
  status?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  athleteIds?: string[];
  athleteNames?: string[];
  driverRating?: number | null;
  ratingComment?: string | null;
  ratedAt?: string | null;
  passengerLat?: number | null;
  passengerLng?: number | null;
  notes?: string | null;
};

type Driver = {
  id: string;
  userId?: string | null;
  fullName?: string | null;
  rut?: string | null;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  status?: string | null;
  vehicleId?: string | null;
  providerId?: string | null;
  eventId?: string | null;
  accreditationStatus?: string | null;
  credentialCode?: string | null;
  accessTypes?: string[] | null;
  metadata?: Record<string, unknown> | null;
  _isParticipant?: boolean;
};

type EventItem = { id: string; name?: string | null };

type VehicleItem = { id: string; plate?: string | null; type?: string | null; brand?: string | null; model?: string | null };

type DelegationItem = { id: string; countryCode?: string | null };

type AthleteItem = {
  id: string;
  fullName?: string | null;
  delegationId?: string | null;
  email?: string | null;
  isDelegationLead?: boolean | null;
};

type ProviderItem = {
  id: string;
  name: string;
  rut?: string | null;
};

type ProviderParticipant = {
  id: string;
  fullName?: string | null;
  rut?: string | null;
  email?: string | null;
  status?: string | null;
  providerId?: string | null;
  metadata?: Record<string, unknown> | null;
};

const statusLabel: Record<string, string> = {
  SCHEDULED: "Programado",
  EN_ROUTE: "En ruta a recoger",
  PICKED_UP: "En curso",
  DROPPED_OFF: "Dejado en hotel",
  COMPLETED: "Viaje completado"
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

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-CL") : "-";

const formatCurrencyCLP = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(value);
};

export default function DriverPortalPage() {
  const { t } = useI18n();
  const [driverId, setDriverId] = useState("");
  const [driverProfile, setDriverProfile] = useState<Driver | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [vehicles, setVehicles] = useState<Record<string, VehicleItem>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [athletes, setAthletes] = useState<Record<string, AthleteItem>>({});
  const [providers, setProviders] = useState<Record<string, ProviderItem>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"actividades" | "reportes" | "cuenta">("actividades");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("hoy");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [destinationFilter, setDestinationFilter] = useState("");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportTypeFilter, setReportTypeFilter] = useState<string>("all");
  const [reportRatingFilter, setReportRatingFilter] = useState<string>("all");
  const [showReportFilters, setShowReportFilters] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);
  const [pickupTrip, setPickupTrip] = useState<Trip | null>(null);
  const [pickupCode, setPickupCode] = useState("");
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [trackingTripId, setTrackingTripId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [seenTripIds, setSeenTripIds] = useState<Set<string>>(() => {
    try { const saved = localStorage.getItem("conductor_seen_trips"); return saved ? new Set(JSON.parse(saved)) : new Set(); } catch { return new Set(); }
  });
  const [driverPosition, setDriverPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<"granted" | "prompt" | "denied" | null>(null);
  const markTripSeen = (tripId: string) => {
    setSeenTripIds((prev) => {
      if (prev.has(tripId)) return prev;
      const next = new Set(prev);
      next.add(tripId);
      try { localStorage.setItem("conductor_seen_trips", JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  const driverNotify = useNotifications();
  const ratedTripIds = useRef<Set<string>>(new Set());
  const tripsRef = useRef<Trip[]>([]);

  // Check & monitor location permission
  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions.query({ name: "geolocation" }).then((result) => {
      setLocationPermission(result.state as "granted" | "prompt" | "denied");
      result.onchange = () => setLocationPermission(result.state as "granted" | "prompt" | "denied");
    }).catch(() => {});
  }, []);

  // Restore session on mount: prefer mobile-app session, fallback to web sessionStorage
  useEffect(() => {
    if (driverProfile) {
      setSessionChecked(true);
      return;
    }
    const session = getMobileSession();
    if (session?.kind === "driver" && session.driverId) {
      loadTrips(session.driverId).finally(() => setSessionChecked(true));
      return;
    }
    try {
      const saved = sessionStorage.getItem("portal_conductor_id");
      if (saved) {
        loadTrips(saved).finally(() => setSessionChecked(true));
      } else {
        setSessionChecked(true);
      }
    } catch { setSessionChecked(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTrips = async (overrideId?: string) => {
    const id = overrideId || driverId;
    if (!id) return;
    if (overrideId) setDriverId(overrideId);
    setLoading(true);
    setError(null);
    setIdError(null);
    try {
      const [
        tripsData,
        driversData,
        eventsData,
        vehiclesData,
        delegationsData,
        athletesData,
        providersData,
        participantsData,
      ] = await Promise.all([
        apiFetch<Trip[]>("/trips"),
        apiFetch<Driver[]>("/drivers"),
        apiFetch<EventItem[]>("/events"),
        apiFetch<VehicleItem[]>("/transports"),
        apiFetch<DelegationItem[]>("/delegations"),
        apiFetch<AthleteItem[]>("/athletes"),
        apiFetch<ProviderItem[]>("/providers"),
        apiFetch<ProviderParticipant[]>("/provider-participants"),
      ]);

      // Merge provider participants who are choferes into the drivers list
      const participantDrivers: Driver[] = (participantsData || [])
        .filter((p) => p.metadata?.isDriver === true || p.metadata?.isDriver === "true")
        .map((p) => ({
          id: p.id,
          fullName: p.fullName,
          rut: p.rut,
          email: p.email,
          status: p.status,
          providerId: p.providerId,
          metadata: p.metadata,
          _isParticipant: true,
        }));

      const allDrivers: Driver[] = [...(driversData || []), ...participantDrivers];

      const normalizedInput = id.trim().toLowerCase();
      const driverMatch = allDrivers.find((driver) => {
        const id = driver.id ?? "";
        const userId = driver.userId ?? "";
        const last6 = id.slice(-6).toLowerCase();
        const last6User = userId.slice(-6).toLowerCase();
        return (
          normalizedInput === last6 ||
          normalizedInput === last6User
        );
      });
      setDriverProfile(driverMatch ?? null);
      if (driverMatch) { try { sessionStorage.setItem("portal_conductor_id", driverId.trim()); } catch {} }
      if (!driverMatch) {
        setIdError(t("El ID ingresado no corresponde a un conductor registrado."));
        setTrips([]);
        return;
      }

      // Request location permission on login
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(() => {}, () => {});
      }

      const driverKeys = new Set(
        [driverMatch?.id, driverMatch?.userId].filter(
          (value): value is string => Boolean(value)
        )
      );
      const filteredTrips = (tripsData || []).filter((trip) => driverKeys.has(trip.driverId));
      setTrips(filteredTrips);

      // Auto-resume tracking if there's already an active trip
      // Only auto-resume tracking for trips already in progress (not just scheduled)
      const activeTrip = filteredTrips.find(
        (trip) => trip.status === "EN_ROUTE" || trip.status === "PICKED_UP"
      );
      if (activeTrip) {
        setTrackingTripId(activeTrip.id);
      }

      setEvents(
        (eventsData || []).reduce<Record<string, EventItem>>((acc, event) => {
          acc[event.id] = event;
          return acc;
        }, {})
      );

      setVehicles(
        (vehiclesData || []).reduce<Record<string, VehicleItem>>((acc, vehicle) => {
          acc[vehicle.id] = vehicle;
          return acc;
        }, {})
      );

      setDelegations(
        (delegationsData || []).reduce<Record<string, DelegationItem>>((acc, delegation) => {
          acc[delegation.id] = delegation;
          return acc;
        }, {})
      );

      setAthletes(
        (filterValidatedAthletes(athletesData || [])).reduce<Record<string, AthleteItem>>((acc, athlete) => {
          acc[athlete.id] = athlete;
          return acc;
        }, {})
      );

      setProviders(
        (providersData || []).reduce<Record<string, ProviderItem>>((acc, provider) => {
          acc[provider.id] = provider;
          return acc;
        }, {})
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cargar"));
    } finally {
      setLoading(false);
    }
  };

  const [showLocationBlockedModal, setShowLocationBlockedModal] = useState(false);

  const requestLocationPermission = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        driverNotify.push("Tu navegador no soporta geolocalización", "⚠️");
        resolve(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => { setLocationPermission("granted"); resolve(true); },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setLocationPermission("denied");
            setShowLocationBlockedModal(true);
          } else {
            driverNotify.push("No se pudo obtener tu ubicación. Verifica que el GPS esté activado", "📍");
          }
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
      );
    });
  };

  const updateTrip = async (tripId: string, status: string) => {
    // Request GPS permission before any trip action that requires location
    if (["EN_ROUTE", "PICKED_UP", "DROPPED_OFF", "COMPLETED"].includes(status)) {
      const hasLocation = await requestLocationPermission();
      if (!hasLocation) return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, string> = { status };
      if (status === "PICKED_UP") {
        payload.startedAt = new Date().toISOString();
      }
      if (status === "DROPPED_OFF" || status === "COMPLETED") {
        payload.completedAt = new Date().toISOString();
      }
      const updated = await apiFetch<Trip>(`/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setTrips((prev) => prev.map((trip) => (trip.id === updated.id ? updated : trip)));
      if (status === "EN_ROUTE" || status === "PICKED_UP") {
        setTrackingTripId(updated.id);
        setSelectedTripId(updated.id);
      }
      if (status === "DROPPED_OFF" || status === "COMPLETED") {
        setTrackingTripId((current) => (current === updated.id ? null : current));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo actualizar"));
    } finally {
      setLoading(false);
    }
  };

  const getPickupCandidates = (trip: Trip) => {
    const candidates = new Set<string>();
    if (trip.requesterAthleteId) {
      const requesterSuffix = trip.requesterAthleteId.slice(-6);
      if (requesterSuffix) candidates.add(requesterSuffix);
    }
    (trip.athleteIds || []).forEach((athleteId) => {
      const suffix = athleteId.slice(-6);
      if (suffix) candidates.add(suffix);
    });
    const delegationIds = (trip.athleteIds || [])
      .map((athleteId) => athletes[athleteId]?.delegationId)
      .filter((value): value is string => Boolean(value));
    const uniqueDelegations = Array.from(new Set(delegationIds));
    uniqueDelegations.forEach((delegationId) => {
      const lead = Object.values(athletes).find(
        (athlete) => athlete.delegationId === delegationId && athlete.isDelegationLead
      );
      if (lead?.id) {
        const suffix = lead.id.slice(-6);
        if (suffix) candidates.add(suffix);
      }
    });
    return candidates;
  };

  const isPortalRequest = (trip: Trip) => trip.tripType === "PORTAL_REQUEST";
  const isDisposicion = (trip: Trip) => trip.tripType === "DISPOSICION_12H";

  const confirmPickup = (trip: Trip) => {
    setPickupTrip(trip);
    setPickupCode("");
    setPickupError(null);
  };

  const submitPickupCode = async () => {
    if (!pickupTrip) return;
    const normalized = pickupCode.trim();
    if (normalized.length < 6) {
      setPickupError(t("El código de usuario ingresado no es válido."));
      return;
    }
    const last6 = normalized.slice(-6).toLowerCase();
    const candidates = getPickupCandidates(pickupTrip);
    if (!candidates.has(last6) && ![...candidates].some((c) => c.toLowerCase() === last6)) {
      setPickupError(t("El código no coincide con el usuario del viaje."));
      return;
    }
    setPickupError(null);
    setPickupTrip(null);
    await updateTrip(pickupTrip.id, "PICKED_UP");
  };

  const sendPosition = async (
    trip: Trip,
    latitude: number,
    longitude: number,
    speed?: number | null,
    heading?: number | null
  ) => {
    const resolvedDriverId = trip.driverId || driverProfile?.id;
    if (!resolvedDriverId) return;
    try {
      await apiFetch(`/vehicle-positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(trip.eventId ? { eventId: trip.eventId } : {}),
          driverId: resolvedDriverId,
          ...(trip.vehicleId ? { vehicleId: trip.vehicleId } : {}),
          timestamp: new Date().toISOString(),
          location: { type: "Point", coordinates: [longitude, latitude] },
          speed,
          heading
        })
      });
    } catch (err) {
      console.error("[GPS] Error enviando posición:", err);
    }
  };

  const getTripById = (tripId: string | null) =>
    tripId ? trips.find((trip) => trip.id === tripId) ?? null : null;

  // Wake Lock: keep screen awake while tracking (prevents browser suspension)
  useEffect(() => {
    if (!trackingTripId) return;
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
          console.log("[WakeLock] Pantalla mantenida activa");
          wakeLock.addEventListener("release", () => console.log("[WakeLock] Liberado"));
        }
      } catch (err) {
        console.warn("[WakeLock] No disponible:", err);
      }
    };

    requestWakeLock();

    // Re-acquire wake lock when tab becomes visible (it gets released on minimize)
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !wakeLock) requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (wakeLock) { try { wakeLock.release(); } catch {} }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [trackingTripId]);

  // GPS tracking: send position every 5s + watchPosition + visibility resume
  useEffect(() => {
    if (!trackingTripId) return;
    const trip = getTripById(trackingTripId);
    if (!trip) return;

    let interval: number | null = null;
    let watchId: number | null = null;

    const tick = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, speed, heading } = pos.coords;
          sendPosition(trip, latitude, longitude, speed ?? null, heading ?? null);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
      );
    };

    // watchPosition fires on every movement (more reliable than polling alone)
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, speed, heading } = pos.coords;
          sendPosition(trip, latitude, longitude, speed ?? null, heading ?? null);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }

    // Polling as backup (watchPosition can be unreliable on some devices)
    tick();
    interval = window.setInterval(tick, 5000);

    // Resume immediately when tab becomes visible
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        // Restart interval (it may have been throttled in background)
        if (interval) window.clearInterval(interval);
        interval = window.setInterval(tick, 5000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (interval) window.clearInterval(interval);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [trackingTripId, trips]);

  // Continuously watch driver GPS position for live map marker (Safari-friendly)
  useEffect(() => {
    if (!driverProfile || !navigator.geolocation) return;
    let cleared = false;
    let watchId: number | null = null;
    let fallbackInterval: number | null = null;
    let gotPosition = false;

    const onPos = (pos: GeolocationPosition) => {
      gotPosition = true;
      setDriverPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    };
    const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 };

    // Try getCurrentPosition first (triggers Safari permission dialog)
    navigator.geolocation.getCurrentPosition(onPos, () => {}, opts);

    watchId = navigator.geolocation.watchPosition(onPos, () => {}, opts);

    // Safari fallback: if watchPosition doesn't fire in 10s, poll with getCurrentPosition
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
  }, [driverProfile?.id]);

  // Keep tripsRef in sync
  useEffect(() => {
    tripsRef.current = trips;
    trips.forEach((t) => { if (t.driverRating) ratedTripIds.current.add(t.id); });
  }, [trips]);

  // Poll for new ratings on completed trips
  useEffect(() => {
    if (!driverProfile) return;

    const checkRatings = async () => {
      const current = tripsRef.current;
      if (current.length === 0) return;
      try {
        const completedIds = current
          .filter((t) => ["COMPLETED", "DROPPED_OFF"].includes(t.status ?? ""))
          .filter((t) => !ratedTripIds.current.has(t.id))
          .map((t) => t.id);
        for (const id of completedIds) {
          const fresh = await apiFetch<Trip>(`/trips/${id}`);
          if (fresh.driverRating && !ratedTripIds.current.has(id)) {
            ratedTripIds.current.add(id);
            const stars = "⭐".repeat(fresh.driverRating);
            const comment = fresh.ratingComment ? `\n"${fresh.ratingComment}"` : "";
            driverNotify.push(`Recibiste ${stars}${comment}`, "🌟");
            setTrips((prev) => prev.map((t) => t.id === id ? fresh : t));
          }
        }
      } catch { /* non-blocking */ }
    };

    const interval = setInterval(checkRatings, 8000);
    return () => clearInterval(interval);
  }, [driverProfile?.id]);

  const getTripAthleteIds = (trip: Trip) => {
    const ids = new Set<string>(trip.athleteIds || []);
    if (trip.requesterAthleteId) ids.add(trip.requesterAthleteId);
    return Array.from(ids);
  };

  const resolveDelegations = (trip: Trip) => {
    const allIds = getTripAthleteIds(trip);
    const ids = allIds
      .map((athleteId) => athletes[athleteId]?.delegationId)
      .filter((value): value is string => Boolean(value));
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return "-";
    const labels = unique
      .map((delegationId) => delegations[delegationId]?.countryCode ?? delegationId)
      .map((code) => countryLabels[code] ?? code);
    return labels.join(", ");
  };

  const resolveDelegationLeads = (trip: Trip) => {
    const allIds = getTripAthleteIds(trip);
    const ids = allIds
      .map((athleteId) => athletes[athleteId]?.delegationId)
      .filter((value): value is string => Boolean(value));
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return "-";
    const leads = unique
      .map((delegationId) => {
        const lead = Object.values(athletes).find(
          (athlete) => athlete.delegationId === delegationId && athlete.isDelegationLead
        );
        if (!lead) return null;
        return lead.fullName || lead.email || lead.id;
      })
      .filter(Boolean);
    return leads.length > 0 ? leads.join(" · ") : "-";
  };

  const resolveAthletes = (trip: Trip) => {
    if (trip.athleteNames && trip.athleteNames.length > 0) {
      return trip.athleteNames.join(", ");
    }
    const allIds = getTripAthleteIds(trip);
    const names = allIds
      .map((athleteId) => athletes[athleteId]?.fullName)
      .filter((value): value is string => Boolean(value));
    return names.length > 0 ? names.join(", ") : "-";
  };

  const typeOptions = Array.from(
    new Set(trips.map((trip) => trip.tripType).filter(Boolean))
  ) as string[];
  const todayKey = new Date().toISOString().slice(0, 10);
  const filteredTrips = trips.filter((trip) => {
    const matchesType = typeFilter === "all" || trip.tripType === typeFilter;
    const destination = (trip.destination || "").toLowerCase();
    const matchesDestination =
      destinationFilter.trim() === "" ||
      destination.includes(destinationFilter.trim().toLowerCase());
    const status = trip.status ?? "";
    const isActive = ["SCHEDULED", "EN_ROUTE", "PICKED_UP"].includes(status);
    const tripDay = (trip.scheduledAt || trip.startedAt || "").slice(0, 10);
    const isToday = tripDay === todayKey || !tripDay;
    const matchesStatus =
      statusFilter === "en_curso" ? (status === "EN_ROUTE" || status === "PICKED_UP") :
      statusFilter === "hoy" ? (isActive && isToday) :
      statusFilter === "todos" ? isActive :
      true;
    return matchesType && matchesDestination && matchesStatus;
  });

  const buildMapsLink = (value?: string | null) => {
    if (!value) return "#";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
  };

  const requestAccess = async () => {
    if (!requestEmail) return;
    setRequestLoading(true);
    setRequestError(null);
    setRequestStatus(null);
    try {
      const response = await apiFetch<{ message?: string }>(`/drivers/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: requestEmail })
      });
      setRequestStatus(response?.message || t("Código enviado al correo"));
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      let message = raw;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.message) {
          message = parsed.message;
        }
      } catch {
        // keep raw
      }
      if (message.includes("conductor registrado")) {
        message = t("El correo ingresado no corresponde a un conductor registrado.");
      }
      setRequestError(message || t("No se pudo actualizar"));
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <>
      {!sessionChecked && !driverProfile && (
        <div style={{ minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#020c18 0%,#0a1628 50%,#041220 100%)",position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",top:"-20%",right:"-10%",width:"50vw",height:"50vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(33,208,179,0.08) 0%,transparent 70%)",pointerEvents:"none" }} />
          <div style={{ position:"absolute",bottom:"-15%",left:"-10%",width:"40vw",height:"40vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(31,205,255,0.06) 0%,transparent 70%)",pointerEvents:"none" }} />
          <div style={{ position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:20 }}>
            <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" style={{ height:48,width:"auto",objectFit:"contain",filter:"drop-shadow(0 0 24px rgba(33,208,179,0.4)) drop-shadow(0 4px 12px rgba(0,0,0,0.6))",marginBottom:8 }} />
            <div style={{ width:44,height:44,position:"relative" }}>
              <div style={{ position:"absolute",inset:0,border:"3px solid rgba(33,208,179,0.15)",borderRadius:"50%" }} />
              <div style={{ position:"absolute",inset:0,border:"3px solid transparent",borderTopColor:"#21D0B3",borderRadius:"50%",animation:"sa-spin 0.9s cubic-bezier(0.4,0,0.2,1) infinite" }} />
            </div>
            <p style={{ fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.5)",margin:0,letterSpacing:"0.03em" }}>Cargando portal...</p>
          </div>
          <style>{`@keyframes sa-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      {sessionChecked && !driverProfile && (
        <div className="flex flex-col lg:flex-row" style={{ minHeight: "100vh", background: "#020c18", position: "relative", overflow: "hidden" }}>
          <style>{`
            @keyframes pc-f1{0%,100%{transform:translateY(0px) scale(1)}50%{transform:translateY(-30px) translateX(10px) scale(1.05)}}
            @keyframes pc-f2{0%,100%{transform:translateY(0px)}50%{transform:translateY(-20px) translateX(15px)}}
            @keyframes pc-pulse{0%,100%{opacity:0.15;transform:scale(1)}50%{opacity:0.4;transform:scale(1.08)}}
            @keyframes pc-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
            @keyframes pc-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
            .pc-form{animation:pc-in 0.6s cubic-bezier(0.16,1,0.3,1) both;animation-delay:0.15s;opacity:0;}
          `}</style>

          {/* Left branding panel */}
          <div className="flex flex-col justify-between p-8 lg:p-14 lg:w-[46%] lg:flex-shrink-0"
            style={{ background: "linear-gradient(160deg,#020c18 0%,#041a2e 40%,#062240 70%,#030f1e 100%)", position: "relative", overflow: "hidden", minHeight: "180px" }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: `linear-gradient(rgba(33,208,179,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.03) 1px,transparent 1px)`, backgroundSize: "60px 60px" }} />
            <div style={{ position: "absolute", top: "-60px", left: "-60px", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(6,34,64,0.6) 0%,transparent 70%)", animation: "pc-f1 12s ease-in-out infinite", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "60px", right: "-40px", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(33,208,179,0.1) 0%,transparent 70%)", animation: "pc-f2 16s ease-in-out infinite", pointerEvents: "none" }} />
            {[480, 340, 200].map((size, i) => (
              <div key={i} style={{ position: "absolute", top: "50%", left: "50%", marginTop: -size / 2, marginLeft: -size / 2, width: size, height: size, borderRadius: "50%", border: `1px solid rgba(33,208,179,${0.04 + i * 0.04})`, animation: `pc-pulse 6s ease-in-out infinite ${i * 2}s`, pointerEvents: "none" }} />
            ))}
            <div style={{ position: "relative", zIndex: 1 }}>
              <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" className="h-14 sm:h-20 lg:h-28" style={{ width: "auto", objectFit: "contain", filter: "drop-shadow(0 0 30px rgba(33,208,179,0.4)) drop-shadow(0 4px 12px rgba(0,0,0,0.9))" }} />
            </div>
            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "16px", padding: "24px 0" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#21D0B3", boxShadow: "0 0 10px #21D0B3", display: "inline-block", animation: "pc-pulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#21D0B3" }}>Portal de Conductores</span>
              </div>
              <h1 style={{ fontSize: "clamp(28px,3vw,44px)", fontWeight: 800, lineHeight: 1.1, color: "#f8fafc", letterSpacing: "-0.02em", margin: 0 }}>
                Gestiona<br />
                <span style={{ background: "linear-gradient(90deg,#21D0B3 0%,#34F3C6 40%,#21D0B3 80%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "pc-shimmer 4s linear infinite" }}>tus viajes</span>
              </h1>
              <p className="hidden sm:block" style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", maxWidth: "340px", lineHeight: 1.7, margin: 0 }}>
                Revisa los traslados asignados, reporta el estado de cada etapa y confirma la recogida de pasajeros.
              </p>
              <div className="hidden lg:flex flex-col" style={{ gap: "10px", marginTop: "8px" }}>
                {([
                  [<svg key="map" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(33,208,179,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>, "Rutas y destinos asignados"],
                  [<svg key="pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(33,208,179,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, "Seguimiento en tiempo real"],
                  [<svg key="check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(33,208,179,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, "Confirmación de pasajeros"],
                ] as [React.ReactNode, string][]).map(([icon, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden lg:flex" style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "20px" }}>
              {[["Acceso seguro", "SSL / HTTPS"], ["GPS tracking", "Tiempo real"], ["Multi-evento", "Global"]].map(([title, sub], i, arr) => (
                <div key={title} style={{ flex: 1, paddingRight: i < arr.length - 1 ? "20px" : "0", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", paddingLeft: i > 0 ? "20px" : "0" }}>
                  <p style={{ fontSize: "14px", fontWeight: 800, color: "#21D0B3", margin: 0, lineHeight: 1 }}>{title}</p>
                  <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)", margin: "3px 0 0", letterSpacing: "0.05em", textTransform: "uppercase" }}>{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right form panel */}
          <div className="flex-1 flex items-center justify-center p-5 sm:p-8 lg:p-16"
            style={{ background: "linear-gradient(160deg,#030f1e 0%,#041a2e 50%,#020c18 100%)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(6,34,64,0.4) 0%,transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "-50px", right: "-50px", width: "280px", height: "280px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(33,208,179,0.08) 0%,transparent 70%)", pointerEvents: "none" }} />
            <div className="pc-form relative z-10 w-full" style={{ maxWidth: "420px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "rgba(255,255,255,0.95)", marginBottom: "6px" }}>{t("Acceder al portal")}</h2>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "28px", lineHeight: 1.6 }}>
                {t("Ingresa tu código de conductor para ver los viajes asignados.")}
              </p>
              <div style={{ display: "grid", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: "8px" }}>{t("Código de conductor")}</span>
                  <input
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadTrips()}
                    placeholder={t("Ingresa tu código")}
                    style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "1px solid rgba(33,208,179,0.2)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.9)", fontSize: "15px", outline: "none", fontWeight: 500, boxSizing: "border-box" }}
                  />
                </div>
                <button type="button" onClick={() => loadTrips()} disabled={loading}
                  style={{ width: "100%", padding: "17px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg,#34F3C6 0%,#21D0B3 50%,#15B09A 100%)", color: "#0d1b3e", fontSize: "16px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, letterSpacing: "0.03em", boxShadow: "0 4px 20px rgba(33,208,179,0.35)" }}>
                  {loading ? t("Cargando...") : t("Ver mis viajes")}
                </button>
                {idError && <p style={{ color: "#fca5a5", fontSize: "13px", textAlign: "center" }}>{idError}</p>}
                {error && <p style={{ color: "#fca5a5", fontSize: "13px", textAlign: "center" }}>{error}</p>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "24px 0" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{t("¿NO TIENES CÓDIGO?")}</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
              </div>
              <div style={{ display: "grid", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: "8px" }}>{t("Correo electrónico")}</span>
                  <input type="email" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} placeholder="email@dominio.com"
                    style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.9)", fontSize: "15px", outline: "none", fontWeight: 500, boxSizing: "border-box" }} />
                </div>
                <button type="button" onClick={requestAccess} disabled={requestLoading}
                  style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "1px solid rgba(33,208,179,0.25)", background: "rgba(33,208,179,0.06)", color: "rgba(255,255,255,0.8)", fontSize: "15px", fontWeight: 500, cursor: requestLoading ? "not-allowed" : "pointer", opacity: requestLoading ? 0.7 : 1 }}>
                  {requestLoading ? t("Enviando...") : t("Solicitar código")}
                </button>
                {requestStatus && <p style={{ color: "#6ee7b7", fontSize: "13px" }}>{requestStatus}</p>}
                {requestError && <p style={{ color: "#fca5a5", fontSize: "13px" }}>{requestError}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {driverProfile && (
        <div style={{ minHeight: "100vh", background: "#eef1f8", position: "relative", overflow: "hidden" }}>
          <style>{`
            @keyframes dc-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
            @keyframes dc-glow{0%,100%{opacity:0.4}50%{opacity:0.8}}
            .dc-card{animation:dc-in .5s cubic-bezier(0.16,1,0.3,1) both;background:#fff;border:1px solid rgba(226,232,240,0.8);border-radius:24px;padding:24px;position:relative;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.05);transition:box-shadow .3s,border-color .3s,transform .3s;}
            .dc-card:nth-child(1){animation-delay:0.07s}.dc-card:nth-child(2){animation-delay:0.14s}.dc-card:nth-child(3){animation-delay:0.21s}
            .dc-card:hover{box-shadow:0 8px 32px rgba(33,208,179,0.14);border-color:rgba(33,208,179,0.28);transform:translateY(-2px);}
            .leaflet-container{font-family:inherit;}
            .dc-logout:hover{background:#f1f5f9!important;border-color:#cbd5e1!important;color:#334155!important;}
            .dc-banner-glow{animation:dc-glow 3s ease-in-out infinite;}
            .dc-banner-inner{padding:14px 20px;display:flex;align-items:center;justify-content:space-between;max-width:960px;margin:0 auto;position:relative;z-index:1;}
            .dc-banner-logo{height:52px;width:auto;object-fit:contain;filter:drop-shadow(0 0 18px rgba(33,208,179,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.8));}
            .dc-banner-tag{display:flex;align-items:center;gap:8px;}
            .dc-banner-tag span{font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(33,208,179,0.9);}
            .dc-content{max-width:920px;margin:0 auto;padding:24px 16px 90px;position:relative;z-index:1;}
            .dc-bottom-tabs{position:fixed;bottom:0;left:0;right:0;z-index:50;background:#fff;border-top:1px solid #e2e8f0;display:flex;padding:4px 0 calc(4px + env(safe-area-inset-bottom,0px));box-shadow:0 -2px 12px rgba(0,0,0,0.06);}
            .dc-tab-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px;background:none;border:none;cursor:pointer;font-size:10px;font-weight:600;transition:color .15s;-webkit-tap-highlight-color:transparent;}
            .dc-profile-card{background:#fff;border-radius:24px;border:1px solid rgba(226,232,240,0.8);padding:24px 28px;margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;animation:dc-in .4s cubic-bezier(0.16,1,0.3,1) both;box-shadow:0 4px 24px rgba(0,0,0,0.06);position:relative;overflow:hidden;}
            .dc-profile-body{display:flex;align-items:center;gap:20px;min-width:0;}
            .dc-avatar{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#21D0B3 0%,#062240 100%);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff;box-shadow:0 6px 24px rgba(33,208,179,0.4);letter-spacing:-0.02em;flex-shrink:0;}
            .dc-profile-name{font-size:clamp(18px,2.5vw,26px);font-weight:800;color:#0f172a;margin:0 0 10px;letter-spacing:-0.02em;line-height:1.15;word-break:break-word;}
            .dc-cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-bottom:20px;}
            .dc-info-strip{display:none;flex-wrap:wrap;gap:6px;margin-bottom:12px;padding:12px 14px;background:#fff;border-radius:16px;border:1px solid rgba(226,232,240,0.8);box-shadow:0 2px 12px rgba(0,0,0,0.04);align-items:center;}
            .dc-info-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:11px;font-weight:600;color:#334155;white-space:nowrap;}
            .dc-trips-section{background:#fff;border-radius:24px;border:1px solid rgba(226,232,240,0.8);padding:24px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.05);animation:dc-in .5s cubic-bezier(0.16,1,0.3,1) both;animation-delay:.28s;position:relative;overflow:hidden;}
            .dc-action-ghost{padding:8px 16px;border-radius:10px;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;}
            .dc-action-ghost:hover{background:#f1f5f9;border-color:#cbd5e1;}
            .dc-action-primary{padding:8px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#34F3C6,#21D0B3);color:#0d1b3e;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(33,208,179,0.3);transition:all .18s;}
            .dc-action-primary:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(33,208,179,0.4);}
            @media(max-width:640px){
              .dc-banner-inner{padding:8px 12px;}.dc-banner-logo{height:32px!important;}
              .dc-content{padding:10px 8px 80px;}
              .dc-profile-card{padding:10px 12px;gap:8px;border-radius:16px;margin-bottom:8px;}
              .dc-profile-body{gap:10px;}
              .dc-avatar{width:36px!important;height:36px!important;font-size:13px!important;}
              .dc-profile-name{font-size:15px!important;margin-bottom:2px!important;}
              .dc-profile-label{display:none!important;}
              .dc-profile-badges{display:none!important;}
              .dc-btn-text{display:none!important;}
              .dc-logout{padding:8px!important;min-width:36px;justify-content:center;}
              .dc-cards-grid{display:none!important;}
              .dc-info-strip{display:flex!important;}
              .dc-trips-section{padding:12px;border-radius:16px;}
              .dc-trips-filters{display:none!important;}
              .dc-action-ghost,.dc-action-primary{padding:12px 16px!important;font-size:13px!important;min-height:44px;}
            }
            @media(max-width:400px){
              .dc-banner-tag{display:none;}
            }
          `}</style>

          {/* Decorative bg */}
          <div style={{ position:"fixed",top:"-120px",right:"-120px",width:"500px",height:"500px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.07) 0%,transparent 65%)",pointerEvents:"none",zIndex:0 }} />
          <div style={{ position:"fixed",bottom:"-80px",left:"-80px",width:"380px",height:"380px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(31,205,255,0.06) 0%,transparent 65%)",pointerEvents:"none",zIndex:0 }} />

          {/* Top banner */}
          <div style={{ position:"relative",background:"linear-gradient(135deg,#041a2e 0%,#062240 45%,#0a3356 80%,#041a2e 100%)",overflow:"hidden",zIndex:1 }}>
            <div style={{ position:"absolute",inset:0,backgroundImage:`linear-gradient(rgba(33,208,179,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.04) 1px,transparent 1px)`,backgroundSize:"48px 48px",pointerEvents:"none" }} />
            <div className="dc-banner-glow" style={{ position:"absolute",bottom:"-1px",left:"0",right:"0",height:"2px",background:"linear-gradient(90deg,transparent,#21D0B3 30%,#34F3C6 50%,#21D0B3 70%,transparent)",pointerEvents:"none" }} />
            <div className="dc-banner-inner">
              <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" className="dc-banner-logo" />
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <NotificationBell
                  notifications={driverNotify.notifications}
                  unreadCount={driverNotify.unreadCount}
                  onMarkAllRead={driverNotify.markAllRead}
                  onClear={driverNotify.clear}
                />
                <button type="button" onClick={() => loadTrips()} disabled={loading}
                  style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:10,border:"1px solid rgba(33,208,179,0.4)",background:"rgba(33,208,179,0.12)",cursor:"pointer",flexShrink:0,opacity:loading?0.5:1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                </button>
                <button type="button" onClick={() => { try { sessionStorage.removeItem("portal_conductor_id"); } catch {} mobileAwareLogout(); }}
                  style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:10,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.08)",cursor:"pointer",flexShrink:0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="dc-content">

            {/* ─── TAB: Actividades ─── */}
            {activeTab === "actividades" && (<>

            {/* Profile card */}
            <div className="dc-profile-card">
              <div style={{ position:"absolute",left:0,top:0,bottom:0,width:"4px",background:"linear-gradient(180deg,#21D0B3,#1FCDFF,#21D0B3)" }} />
              <div style={{ position:"absolute",top:0,right:0,width:"200px",height:"200px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.05) 0%,transparent 65%)",transform:"translate(60px,-60px)",pointerEvents:"none" }} />
              <div className="dc-profile-body">
                <div style={{ position:"relative",flexShrink:0 }}>
                  {(driverProfile.photoUrl || (driverProfile.metadata as any)?.photoUrl) ? (
                    <img src={driverProfile.photoUrl || (driverProfile.metadata as any)?.photoUrl} alt="Foto" style={{ width:64,height:64,borderRadius:"50%",objectFit:"cover",boxShadow:"0 6px 24px rgba(33,208,179,0.3)" }} />
                  ) : (
                    <div className="dc-avatar">
                      {(driverProfile.fullName || "C").split(" ").slice(0,2).map((w: string) => w[0] ?? "").join("").toUpperCase() || "C"}
                    </div>
                  )}
                  <div style={{ position:"absolute",bottom:2,right:2,width:12,height:12,borderRadius:"50%",background:"#21D0B3",border:"2px solid #fff",boxShadow:"0 0 8px rgba(33,208,179,0.8)" }} />
                </div>
                <div style={{ minWidth:0 }}>
                  <p className="dc-profile-label" style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#21D0B3",margin:"0 0 5px" }}>{t("Perfil")}</p>
                  <h1 className="dc-profile-name">{driverProfile.fullName || t("Conductor")}</h1>
                  <div className="dc-profile-badges" style={{ display:"flex",flexWrap:"wrap",gap:"6px" }}>
                    {driverProfile.rut && (
                      <span style={{ fontSize:"11px",fontWeight:600,padding:"4px 12px",borderRadius:"20px",background:"#f1f5f9",color:"#334155",border:"1px solid #dde3ed" }}>
                        RUT: {driverProfile.rut}
                      </span>
                    )}
                    {(() => {
                      const prov = driverProfile.providerId ? providers[driverProfile.providerId] : null;
                      return prov ? (
                        <span style={{ fontSize:"11px",fontWeight:700,padding:"4px 12px",borderRadius:"20px",background:"linear-gradient(135deg,rgba(33,208,179,0.12),rgba(33,208,179,0.06))",color:"#0a7a6b",border:"1px solid rgba(33,208,179,0.3)" }}>
                          {prov.name}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Info cards */}
            <div className="dc-cards-grid">
              {/* Correo */}
              <div className="dc-card">
                <div style={{ position:"absolute",top:0,right:0,width:"110px",height:"110px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.09) 0%,transparent 70%)",transform:"translate(28px,-28px)",pointerEvents:"none" }} />
                <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px" }}>
                  <div style={{ width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,rgba(33,208,179,0.18),rgba(33,208,179,0.06))",border:"1px solid rgba(33,208,179,0.25)",display:"flex",alignItems:"center",justifyContent:"center",color:"#21D0B3",flexShrink:0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#21D0B3" }}>{t("Correo")}</span>
                </div>
                <p style={{ fontSize:"15px",fontWeight:700,color:"#0f172a",margin:0,wordBreak:"break-all" }}>{driverProfile.email || "-"}</p>
              </div>

              {/* Vehículo */}
              <div className="dc-card">
                <div style={{ position:"absolute",top:0,right:0,width:"110px",height:"110px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(52,243,198,0.08) 0%,transparent 70%)",transform:"translate(28px,-28px)",pointerEvents:"none" }} />
                <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px" }}>
                  <div style={{ width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,rgba(52,243,198,0.18),rgba(52,243,198,0.06))",border:"1px solid rgba(52,243,198,0.25)",display:"flex",alignItems:"center",justifyContent:"center",color:"#0fa894",flexShrink:0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3v-6l2.5-5h11L19 11v6h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M5 11h14"/></svg>
                  </div>
                  <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#0fa894" }}>{t("Vehículo")}</span>
                </div>
                {(() => {
                  const veh = driverProfile.vehicleId ? vehicles[driverProfile.vehicleId] : null;
                  const meta = driverProfile.metadata ?? {};
                  const metaPlate = meta.vehiclePatente as string | null | undefined;
                  const metaBrand = meta.vehicleMarca as string | null | undefined;
                  const metaModel = meta.vehicleModelo as string | null | undefined;
                  const metaType = meta.vehicleTipo as string | null | undefined;
                  const plate = veh?.plate || metaPlate;
                  const type = veh?.type || metaType;
                  const brand = veh?.brand || metaBrand;
                  const model = veh?.model || metaModel;
                  if (!plate && !brand && !model) return <p style={{ fontSize:"14px",color:"#94a3b8",margin:0,fontStyle:"italic" }}>{t("Sin vehículo asignado")}</p>;
                  return (
                    <>
                      <p style={{ fontSize:"15px",fontWeight:700,color:"#0f172a",margin:"0 0 8px" }}>{plate?.toUpperCase() || "-"}</p>
                      <div style={{ display:"flex",flexWrap:"wrap",gap:"6px" }}>
                        {type && <span style={{ fontSize:"11px",padding:"3px 9px",borderRadius:"8px",background:"#f0fdf8",color:"#0a7a6b",border:"1px solid rgba(33,208,179,0.2)",fontWeight:600 }}>{type.toUpperCase()}</span>}
                        {brand && <span style={{ fontSize:"11px",padding:"3px 9px",borderRadius:"8px",background:"#f1f5f9",color:"#475569",border:"1px solid #e2e8f0",fontWeight:500 }}>{brand.toUpperCase()}</span>}
                        {model && <span style={{ fontSize:"11px",padding:"3px 9px",borderRadius:"8px",background:"#f1f5f9",color:"#475569",border:"1px solid #e2e8f0",fontWeight:500 }}>{model.toUpperCase()}</span>}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Proveedor */}
              <div className="dc-card">
                <div style={{ position:"absolute",top:0,right:0,width:"110px",height:"110px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(31,205,255,0.07) 0%,transparent 70%)",transform:"translate(28px,-28px)",pointerEvents:"none" }} />
                <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px" }}>
                  <div style={{ width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,rgba(31,205,255,0.15),rgba(31,205,255,0.05))",border:"1px solid rgba(31,205,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",color:"#0ea5c8",flexShrink:0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
                  </div>
                  <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#0ea5c8" }}>{t("Proveedor")}</span>
                </div>
                {(() => {
                  const prov = driverProfile.providerId ? providers[driverProfile.providerId] : null;
                  if (!prov) return <p style={{ fontSize:"14px",color:"#94a3b8",margin:0,fontStyle:"italic" }}>{t("Sin proveedor asignado")}</p>;
                  return (
                    <>
                      <p style={{ fontSize:"15px",fontWeight:700,color:"#0f172a",margin:"0 0 4px" }}>{prov.name}</p>
                      {prov.rut && <p style={{ fontSize:"12px",color:"#64748b",margin:0 }}>RUT: {prov.rut}</p>}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Compact info strip (mobile only) */}
            <div className="dc-info-strip">
              {(() => {
                const veh = driverProfile.vehicleId ? vehicles[driverProfile.vehicleId] : null;
                const meta = driverProfile.metadata ?? {};
                const plate = veh?.plate || (meta.vehiclePatente as string | null);
                const prov = driverProfile.providerId ? providers[driverProfile.providerId] : null;
                return (
                  <>
                    {plate && (
                      <span className="dc-info-chip">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2"><path d="M5 17H3v-6l2.5-5h11L19 11v6h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>
                        {plate.toUpperCase()}
                      </span>
                    )}
                    {prov && <span className="dc-info-chip" style={{ color:"#0a7a6b",borderColor:"rgba(33,208,179,0.3)",background:"rgba(33,208,179,0.06)" }}>{prov.name}</span>}
                    {driverProfile.rut && <span className="dc-info-chip">RUT: {driverProfile.rut}</span>}
                  </>
                );
              })()}
            </div>

            {/* Trips */}
            <div className="dc-trips-section">
              <div style={{ position:"absolute",top:0,right:0,width:"160px",height:"160px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.05) 0%,transparent 70%)",transform:"translate(50px,-50px)",pointerEvents:"none" }} />
              <div style={{ display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:"12px",marginBottom:"20px",position:"relative" }}>
                <div>
                  <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
                    <h2 style={{ fontSize:"18px",fontWeight:800,color:"#0f172a",margin:0,letterSpacing:"-0.01em" }}>
                      {t("Viajes")} <span style={{ color:"#64748b",fontWeight:600 }}>({filteredTrips.length})</span>
                    </h2>
                    {trackingTripId && (
                      <div style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:"20px",background:"rgba(33,208,179,0.1)",border:"1px solid rgba(33,208,179,0.3)" }}>
                        <div style={{ width:6,height:6,borderRadius:"50%",background:"#21D0B3",animation:"dc-glow 1.5s ease-in-out infinite" }} />
                        <span style={{ fontSize:"10px",fontWeight:700,color:"#21D0B3" }}>GPS</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="dc-trips-filters" style={{ display:"flex",flexWrap:"wrap",gap:"8px",alignItems:"center" }}>
                  <label style={{ display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:"#64748b" }}>
                    {t("Tipo")}
                    <select className="input h-9 min-w-[140px] pr-10 !text-[12px] !leading-tight !pt-[0.4rem] !pb-[0.2rem]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                      <option value="all">{t("Todos")}</option>
                      {typeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label style={{ display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:"#64748b" }}>
                    {t("Destino")}
                    <input className="input h-9" value={destinationFilter} onChange={(e) => setDestinationFilter(e.target.value)} placeholder={t("Filtrar por destino")} />
                  </label>
                </div>
              </div>

              {/* Status filter tabs */}
              <div style={{ display:"flex",gap:4,marginBottom:12,background:"#f1f5f9",borderRadius:10,padding:3 }}>
                {([
                  { key: "en_curso", label: "En curso", count: trips.filter((t) => t.status === "EN_ROUTE" || t.status === "PICKED_UP").length, unread: 0 },
                  { key: "hoy", label: "Hoy", count: trips.filter((t) => ["SCHEDULED","EN_ROUTE","PICKED_UP"].includes(t.status ?? "") && ((t.scheduledAt || t.startedAt || "").slice(0,10) === todayKey || !(t.scheduledAt || t.startedAt))).length, unread: trips.filter((t) => t.status === "SCHEDULED" && !seenTripIds.has(t.id) && ((t.scheduledAt || t.startedAt || "").slice(0,10) === todayKey || !(t.scheduledAt || t.startedAt))).length },
                  { key: "todos", label: "Programados", count: trips.filter((t) => ["SCHEDULED","EN_ROUTE","PICKED_UP"].includes(t.status ?? "")).length, unread: trips.filter((t) => t.status === "SCHEDULED" && !seenTripIds.has(t.id)).length },
                ]).map(({ key, label, count, unread }) => (
                  <button key={key} type="button" onClick={() => setStatusFilter(key)}
                    style={{
                      flex:1,padding:"7px 8px",borderRadius:8,border:"none",
                      background: statusFilter === key ? "#fff" : "transparent",
                      boxShadow: statusFilter === key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                      color: statusFilter === key ? "#0f172a" : "#94a3b8",
                      fontSize:12,fontWeight: statusFilter === key ? 700 : 500,cursor:"pointer",transition:"all .15s",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:4,
                    }}>
                    {t(label)}
                    <span style={{
                      fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:6,
                      background: statusFilter === key ? "rgba(33,208,179,0.15)" : "transparent",
                      color: statusFilter === key ? "#0a7a6b" : "#b0b8c4",
                    }}>{count}</span>
                    {unread > 0 && (
                      <span style={{ fontSize:9,fontWeight:800,padding:"2px 6px",borderRadius:"99px",background:"#ef4444",color:"#fff",minWidth:16,textAlign:"center" }}>{unread}</span>
                    )}
                  </button>
                ))}
              </div>

              {filteredTrips.length === 0 ? (
                <div style={{ textAlign:"center",padding:"32px 20px" }}>
                  <p style={{ fontSize:13,color:"#94a3b8",margin:0 }}>{t("No hay viajes asignados aún.")}</p>
                </div>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {filteredTrips.map((trip) => {
                    const status = trip.status || "SCHEDULED";
                    const isSelected = selectedTripId === trip.id;
                    const isActive = status === "EN_ROUTE" || status === "PICKED_UP";
                    const isCompleted = status === "COMPLETED" || status === "DROPPED_OFF";
                    const isSeen = seenTripIds.has(trip.id);
                    const isNew = status === "SCHEDULED" && !isSeen;
                    const tripVehicle = vehicles[trip.vehicleId];
                    const passengerCount = getTripAthleteIds(trip).length;

                    return (
                      <div key={trip.id} style={{
                        borderRadius:14,
                        border: isSelected ? "1px solid rgba(33,208,179,0.4)" : isNew ? "1px solid rgba(59,130,246,0.3)" : "1px solid #f1f5f9",
                        background: isNew ? "rgba(59,130,246,0.03)" : "#fff",
                        overflow:"hidden",transition:"all .15s",
                      }}>

                        {/* ── Compact row (always visible) ── */}
                        <button type="button" onClick={() => { setSelectedTripId(isSelected ? null : trip.id); markTripSeen(trip.id); }}
                          style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}>
                          {/* Status dot + new badge */}
                          <div style={{ position:"relative",flexShrink:0 }}>
                            <span style={{
                              width:10,height:10,borderRadius:"50%",display:"block",
                              background: isActive ? "#7c3aed" : isCompleted ? "#21D0B3" : isNew ? "#3b82f6" : "#0ea5e9",
                              boxShadow: isActive ? "0 0 8px rgba(124,58,237,0.4)" : isNew ? "0 0 8px rgba(59,130,246,0.4)" : "none",
                            }} />
                            {isNew && <span style={{ position:"absolute",top:"-6px",right:"-8px",width:6,height:6,borderRadius:"50%",background:"#ef4444",border:"1px solid #fff" }} />}
                          </div>
                          {/* Route summary */}
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                              <p style={{ fontSize:13,fontWeight: isNew ? 800 : 600,color: isNew ? "#1e40af" : "#0f172a",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                {isDisposicion(trip)
                                  ? "Disposición 12h"
                                  : `${trip.origin?.split(",")[0] || "—"} → ${trip.destination?.split(",")[0] || "—"}`}
                              </p>
                              {isNew && (
                                <span style={{ fontSize:9,fontWeight:800,padding:"2px 6px",borderRadius:"99px",background:"#3b82f6",color:"#fff",flexShrink:0,letterSpacing:"0.05em" }}>NUEVO</span>
                              )}
                            </div>
                            <p style={{ fontSize:10.5,color: isNew ? "#3b82f6" : "#94a3b8",margin:"2px 0 0",fontWeight: isNew ? 600 : 400 }}>
                              {trip.scheduledAt ? formatDate(trip.scheduledAt) : "—"} · {statusLabel[status] || status}
                              {passengerCount > 0 ? ` · ${passengerCount} pax` : ""}
                            </p>
                          </div>
                          {/* Expand arrow */}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0,transition:"transform .2s",transform:isSelected?"rotate(180deg)":"rotate(0)" }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {/* ── Expanded detail ── */}
                        {isSelected && (
                          <div style={{ padding:"0 12px 14px" }}>
                            {isDisposicion(trip) ? (
                              /* Disposición 12h: simplified header, no map/route */
                              <div style={{ padding:"12px 14px",borderRadius:12,background:"linear-gradient(135deg,rgba(99,102,241,0.06),rgba(33,208,179,0.06))",border:"1px solid rgba(99,102,241,0.15)",marginBottom:10 }}>
                                <p style={{ fontSize:11,fontWeight:700,color:"#6366f1",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Servicio a disposición — 12 horas</p>
                                <p style={{ fontSize:12,color:"#64748b",margin:"4px 0 0" }}>
                                  {trip.scheduledAt ? formatDate(trip.scheduledAt) : "Sin fecha programada"}
                                </p>
                                {trip.notes && <p style={{ fontSize:12,color:"#334155",margin:"6px 0 0",lineHeight:1.4 }}>{trip.notes}</p>}
                              </div>
                            ) : (
                              <>
                              {/* Map */}
                              <div style={{ borderRadius:12,overflow:"hidden",marginBottom:10 }}>
                                <TripMap origin={trip.origin} destination={trip.destination} driverPosition={driverPosition} userPosition={trip.passengerLat && trip.passengerLng ? { lat: trip.passengerLat, lng: trip.passengerLng } : null} height={180} />
                              </div>

                              {/* Navigate with Waze / Google Maps */}
                              {trip.destination && (
                                <div style={{ display:"flex",gap:6,marginBottom:10 }}>
                                  <a
                                    href={`https://waze.com/ul?q=${encodeURIComponent(trip.destination)}&navigate=yes`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 0",borderRadius:10,border:"1px solid #e2e8f0",background:"#fff",textDecoration:"none",fontSize:12,fontWeight:700,color:"#33ccff" }}
                                  >
                                    <img src="https://www.waze.com/favicon.ico" alt="Waze" width="20" height="20" style={{ borderRadius:4 }} />
                                    Waze
                                  </a>
                                  <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trip.destination)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 0",borderRadius:10,border:"1px solid #e2e8f0",background:"#fff",textDecoration:"none",fontSize:12,fontWeight:700,color:"#4285F4" }}
                                  >
                                    <img src="https://maps.google.com/favicon.ico" alt="Google Maps" width="20" height="20" style={{ borderRadius:4 }} />
                                    Google Maps
                                  </a>
                                </div>
                              )}

                              {/* Route detail */}
                              <div style={{ display:"flex",gap:10,marginBottom:10,alignItems:"stretch" }}>
                                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",paddingTop:2 }}>
                                  <span style={{ width:8,height:8,borderRadius:"50%",background:"#21D0B3",flexShrink:0 }} />
                                  <div style={{ width:2,flex:1,background:"linear-gradient(180deg,#21D0B3,#ef4444)",margin:"3px 0",opacity:0.3,borderRadius:1 }} />
                                  <span style={{ width:8,height:8,borderRadius:"50%",background:"#ef4444",flexShrink:0 }} />
                                </div>
                                <div style={{ flex:1,display:"flex",flexDirection:"column",justifyContent:"space-between",gap:4 }}>
                                  <div>
                                    <p style={{ fontSize:10,color:"#94a3b8",margin:0 }}>{t("Recogida")}</p>
                                    <p style={{ fontSize:13,fontWeight:700,color:"#0f172a",margin:"1px 0 0" }}>{trip.origin || "—"}</p>
                                  </div>
                                  <div>
                                    <p style={{ fontSize:10,color:"#94a3b8",margin:0 }}>{t("Destino")}</p>
                                    <p style={{ fontSize:13,fontWeight:700,color:"#0f172a",margin:"1px 0 0" }}>{trip.destination || "—"}</p>
                                  </div>
                                </div>
                              </div>
                              </>
                            )}

                            {/* Info chips */}
                            <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginBottom:10 }}>
                              {tripVehicle?.plate && (
                                <span style={{ fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:6,background:"#f8fafc",border:"1px solid #e2e8f0",color:"#334155" }}>
                                  {tripVehicle.plate.toUpperCase()}
                                </span>
                              )}
                              {trip.tripCost != null && (
                                <span style={{ fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:6,background:"#f0fdfb",border:"1px solid rgba(33,208,179,0.2)",color:"#0a7a6b" }}>
                                  {formatCurrencyCLP(trip.tripCost)}
                                </span>
                              )}
                              {resolveDelegations(trip) !== "-" && (
                                <span style={{ fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:6,background:"#f8fafc",border:"1px solid #e2e8f0",color:"#334155" }}>
                                  {resolveDelegations(trip)}
                                </span>
                              )}
                            </div>

                            {/* Action button */}
                            {isCompleted ? (
                              <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:10,borderRadius:12,background:"rgba(33,208,179,0.06)",border:"1px solid rgba(33,208,179,0.15)" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                <span style={{ fontSize:12,fontWeight:700,color:"#21D0B3" }}>{t("Completado")}</span>
                                {trip.driverRating && <span style={{ fontSize:12 }}>{"⭐".repeat(trip.driverRating)}</span>}
                              </div>
                            ) : isDisposicion(trip) ? (
                              /* ── Disposición 12h: 2-step flow ── */
                              status === "SCHEDULED" ? (
                                trackingTripId && trackingTripId !== trip.id ? (
                                  <div style={{ padding:10,borderRadius:12,background:"#f8fafc",border:"1px solid #e2e8f0",textAlign:"center" }}>
                                    <p style={{ fontSize:11,color:"#94a3b8",margin:0 }}>Finaliza el servicio en curso para iniciar este</p>
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => updateTrip(trip.id, "PICKED_UP")} disabled={loading}
                                    style={{ width:"100%",padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#818cf8,#6366f1)",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:"0 3px 12px rgba(99,102,241,0.3)",opacity:loading?0.7:1 }}>
                                    {t("Iniciar servicio")}
                                  </button>
                                )
                              ) : status === "EN_ROUTE" || status === "PICKED_UP" ? (
                                <button type="button" onClick={() => updateTrip(trip.id, "COMPLETED")} disabled={loading}
                                  style={{ width:"100%",padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#34F3C6,#21D0B3)",color:"#0d1b3e",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:"0 3px 12px rgba(33,208,179,0.3)",opacity:loading?0.7:1 }}>
                                  {t("Finalizar servicio")}
                                </button>
                              ) : null
                            ) : status === "SCHEDULED" ? (
                              trackingTripId && trackingTripId !== trip.id ? (
                                <div style={{ padding:10,borderRadius:12,background:"#f8fafc",border:"1px solid #e2e8f0",textAlign:"center" }}>
                                  <p style={{ fontSize:11,color:"#94a3b8",margin:0 }}>Finaliza el viaje en curso para iniciar este</p>
                                </div>
                              ) : (
                                <button type="button" onClick={() => updateTrip(trip.id, "EN_ROUTE")} disabled={loading}
                                  style={{ width:"100%",padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#34F3C6,#21D0B3)",color:"#0d1b3e",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:"0 3px 12px rgba(33,208,179,0.3)",opacity:loading?0.7:1 }}>
                                  {t("Iniciar — En ruta a recoger")}
                                </button>
                              )
                            ) : status === "EN_ROUTE" ? (
                              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                                <button type="button" onClick={() => confirmPickup(trip)} disabled={loading}
                                  style={{ width:"100%",padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#34F3C6,#21D0B3)",color:"#0d1b3e",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:"0 3px 12px rgba(33,208,179,0.3)",opacity:loading?0.7:1 }}>
                                  {isPortalRequest(trip) ? t("Pasajero recogido — En curso") : t("Pasajero recogido")}
                                </button>
                                <button type="button" onClick={() => updateTrip(trip.id, "SCHEDULED")} disabled={loading}
                                  style={{ padding:8,borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:11,fontWeight:600,cursor:"pointer" }}>
                                  {t("← Volver a Programado")}
                                </button>
                              </div>
                            ) : status === "PICKED_UP" ? (
                              <button type="button"
                                onClick={() => isPortalRequest(trip) ? updateTrip(trip.id, "COMPLETED") : updateTrip(trip.id, "DROPPED_OFF")}
                                disabled={loading}
                                style={{ width:"100%",padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#34F3C6,#21D0B3)",color:"#0d1b3e",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:"0 3px 12px rgba(33,208,179,0.3)",opacity:loading?0.7:1 }}>
                                {isPortalRequest(trip) ? t("Finalizar viaje") : t("Llegamos al destino")}
                              </button>
                            ) : status === "DROPPED_OFF" ? (
                              <button type="button" onClick={() => updateTrip(trip.id, "COMPLETED")} disabled={loading}
                                style={{ width:"100%",padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#34F3C6,#21D0B3)",color:"#0d1b3e",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:"0 3px 12px rgba(33,208,179,0.3)",opacity:loading?0.7:1 }}>
                                {t("Confirmar viaje completado")}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            </>)}

            {/* ─── TAB: Reportes ─── */}
            {activeTab === "reportes" && (() => {
              const allCompleted = trips
                .filter((t) => t.status === "COMPLETED" || t.status === "DROPPED_OFF")
                .sort((a, b) => new Date(b.completedAt || b.startedAt || 0).getTime() - new Date(a.completedAt || a.startedAt || 0).getTime());

              // Collect unique trip types for filter
              const tripTypes = Array.from(new Set(allCompleted.map((t) => t.tripType).filter(Boolean))) as string[];

              // Apply filters
              const completed = allCompleted.filter((t) => {
                // Date range
                const tDate = new Date(t.completedAt || t.startedAt || 0);
                if (reportDateFrom) {
                  const from = new Date(reportDateFrom + "T00:00:00");
                  if (tDate < from) return false;
                }
                if (reportDateTo) {
                  const to = new Date(reportDateTo + "T23:59:59");
                  if (tDate > to) return false;
                }
                // Trip type
                if (reportTypeFilter !== "all" && t.tripType !== reportTypeFilter) return false;
                // Rating
                if (reportRatingFilter === "rated" && !t.driverRating) return false;
                if (reportRatingFilter === "unrated" && t.driverRating) return false;
                return true;
              });

              const totalCost = completed.reduce((sum, t) => sum + (Number(t.tripCost) || 0), 0);
              const rated = completed.filter((t) => t.driverRating);
              const avgRating = rated.length > 0 ? (rated.reduce((sum, t) => sum + (t.driverRating || 0), 0) / rated.length).toFixed(1) : null;
              const hasActiveFilters = reportDateFrom || reportDateTo || reportTypeFilter !== "all" || reportRatingFilter !== "all";

              return (
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {/* Summary stats */}
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
                    <div style={{ padding:"12px 8px",borderRadius:12,background:"#fff",border:"1px solid #e2e8f0",textAlign:"center" }}>
                      <p style={{ fontSize:9,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Viajes</p>
                      <p style={{ fontSize:22,fontWeight:800,color:"#0f172a",margin:"4px 0 0" }}>{completed.length}</p>
                    </div>
                    <div style={{ padding:"12px 8px",borderRadius:12,background:"#fff",border:"1px solid #e2e8f0",textAlign:"center" }}>
                      <p style={{ fontSize:9,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Total</p>
                      <p style={{ fontSize:22,fontWeight:800,color:"#21D0B3",margin:"4px 0 0" }}>${totalCost.toLocaleString("es-CL")}</p>
                    </div>
                    <div style={{ padding:"12px 8px",borderRadius:12,background:"#fff",border:"1px solid #e2e8f0",textAlign:"center" }}>
                      <p style={{ fontSize:9,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.1em" }}>Rating</p>
                      <p style={{ fontSize:22,fontWeight:800,color:"#f59e0b",margin:"4px 0 0" }}>{avgRating ? `${avgRating} ⭐` : "—"}</p>
                    </div>
                  </div>

                  {/* Filter toggle button */}
                  <button type="button" onClick={() => setShowReportFilters(!showReportFilters)}
                    style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"8px",borderRadius:10,
                      background: hasActiveFilters ? "#21D0B3" : "#fff", border:"1px solid #e2e8f0",cursor:"pointer",width:"100%" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hasActiveFilters ? "#fff" : "#64748b"} strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                    <span style={{ fontSize:12,fontWeight:600,color: hasActiveFilters ? "#fff" : "#64748b" }}>
                      {showReportFilters ? "Ocultar filtros" : "Filtrar"}
                    </span>
                    {hasActiveFilters && <span style={{ background:"#fff",color:"#21D0B3",borderRadius:10,padding:"0 6px",fontSize:10,fontWeight:800 }}>{completed.length}/{allCompleted.length}</span>}
                  </button>

                  {/* Collapsible filters */}
                  {showReportFilters && (
                    <div style={{ background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",padding:"10px 14px",display:"flex",flexDirection:"column",gap:8 }}>
                      <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                        <label style={{ display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0 }}>
                          <span style={{ fontSize:11,fontWeight:700,color:"#64748b",flexShrink:0 }}>Desde</span>
                          <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)}
                            style={{ flex:1,minWidth:0,padding:"7px 6px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12,color:"#0f172a",background:"#f8fafc",boxSizing:"border-box" }} />
                        </label>
                        <label style={{ display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0 }}>
                          <span style={{ fontSize:11,fontWeight:700,color:"#64748b",flexShrink:0 }}>Hasta</span>
                          <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)}
                            style={{ flex:1,minWidth:0,padding:"7px 6px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12,color:"#0f172a",background:"#f8fafc",boxSizing:"border-box" }} />
                        </label>
                      </div>
                      <label style={{ display:"flex",alignItems:"center",gap:6 }}>
                        <span style={{ fontSize:11,fontWeight:700,color:"#64748b",flexShrink:0 }}>Tipo</span>
                        <select value={reportTypeFilter} onChange={(e) => setReportTypeFilter(e.target.value)}
                          style={{ flex:1,padding:"7px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12,color:"#0f172a",background:"#f8fafc",boxSizing:"border-box" }}>
                          <option value="all">Todos</option>
                          {tripTypes.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
                        </select>
                      </label>
                      {hasActiveFilters && (
                        <button type="button" onClick={() => { setReportDateFrom(""); setReportDateTo(""); setReportTypeFilter("all"); setReportRatingFilter("all"); }}
                          style={{ fontSize:12,color:"#ef4444",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0,alignSelf:"flex-end" }}>
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  )}

                  {/* Trip list */}
                  <div style={{ background:"#fff",borderRadius:14,border:"1px solid #e2e8f0",overflow:"hidden" }}>
                    <div style={{ padding:"12px 14px 8px" }}>
                      <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"#21D0B3",margin:0 }}>Historial</p>
                    </div>
                    {completed.length === 0 ? (
                      <p style={{ fontSize:13,color:"#94a3b8",textAlign:"center",padding:"20px 14px" }}>Sin viajes completados</p>
                    ) : (
                      <div style={{ display:"flex",flexDirection:"column" }}>
                        {completed.map((trip) => {
                          const veh = trip.vehicleId ? vehicles[trip.vehicleId] : null;
                          const isOpen = selectedTripId === trip.id;
                          const completedDate = trip.completedAt || trip.startedAt;
                          const passengerCount = getTripAthleteIds(trip).length;
                          return (
                            <div key={trip.id} style={{ borderTop:"1px solid #f1f5f9" }}>
                              {/* Row */}
                              <button type="button" onClick={() => setSelectedTripId(isOpen ? null : trip.id)}
                                style={{ width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}>
                                <span style={{ width:8,height:8,borderRadius:"50%",background:"#21D0B3",flexShrink:0 }} />
                                <div style={{ flex:1,minWidth:0 }}>
                                  <p style={{ fontSize:12.5,fontWeight:600,color:"#0f172a",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                    {(trip.origin?.split(",")[0] || "—")} → {(trip.destination?.split(",")[0] || "—")}
                                  </p>
                                  <p style={{ fontSize:10,color:"#94a3b8",margin:"1px 0 0" }}>
                                    {completedDate ? new Date(completedDate).toLocaleDateString("es-CL",{ day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit" }) : "—"}
                                  </p>
                                </div>
                                {trip.driverRating && (
                                  <div style={{ display:"flex",alignItems:"center",gap:2,flexShrink:0 }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                    <span style={{ fontSize:10,fontWeight:700,color:"#f59e0b" }}>{trip.driverRating}</span>
                                  </div>
                                )}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0,transition:"transform .15s",transform:isOpen?"rotate(180deg)":"rotate(0)" }}>
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                              {/* Detail */}
                              {isOpen && (
                                <div style={{ padding:"0 14px 14px",display:"flex",flexDirection:"column",gap:8 }}>
                                  {/* Route detail */}
                                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
                                    <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                      <p style={{ fontSize:9,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.08em" }}>Origen</p>
                                      <p style={{ fontSize:12,fontWeight:600,color:"#0f172a",margin:"2px 0 0",lineHeight:1.3 }}>{trip.origin || "—"}</p>
                                    </div>
                                    <div style={{ padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                      <p style={{ fontSize:9,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase",letterSpacing:"0.08em" }}>Destino</p>
                                      <p style={{ fontSize:12,fontWeight:600,color:"#0f172a",margin:"2px 0 0",lineHeight:1.3 }}>{trip.destination || "—"}</p>
                                    </div>
                                  </div>
                                  {/* Info grid */}
                                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6 }}>
                                    <div style={{ padding:"6px 8px",borderRadius:8,background:"#f8fafc",border:"1px solid #f1f5f9",textAlign:"center" }}>
                                      <p style={{ fontSize:8,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase" }}>Vehículo</p>
                                      <p style={{ fontSize:11,fontWeight:600,color:"#0f172a",margin:"1px 0 0" }}>{veh?.plate?.toUpperCase() || "—"}</p>
                                    </div>
                                    <div style={{ padding:"6px 8px",borderRadius:8,background:"#f8fafc",border:"1px solid #f1f5f9",textAlign:"center" }}>
                                      <p style={{ fontSize:8,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase" }}>Costo</p>
                                      <p style={{ fontSize:11,fontWeight:700,color:"#0a7a6b",margin:"1px 0 0" }}>{trip.tripCost ? `$${Number(trip.tripCost).toLocaleString("es-CL")}` : "—"}</p>
                                    </div>
                                    <div style={{ padding:"6px 8px",borderRadius:8,background:"#f8fafc",border:"1px solid #f1f5f9",textAlign:"center" }}>
                                      <p style={{ fontSize:8,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase" }}>Pasajeros</p>
                                      <p style={{ fontSize:11,fontWeight:600,color:"#0f172a",margin:"1px 0 0" }}>{passengerCount || "—"}</p>
                                    </div>
                                  </div>
                                  {/* Delegations */}
                                  {resolveDelegations(trip) !== "-" && (
                                    <div style={{ padding:"6px 10px",borderRadius:8,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                      <p style={{ fontSize:9,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase" }}>Delegación</p>
                                      <p style={{ fontSize:11,fontWeight:600,color:"#0f172a",margin:"1px 0 0" }}>{resolveDelegations(trip)}</p>
                                    </div>
                                  )}
                                  {/* Times */}
                                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
                                    <div style={{ padding:"6px 10px",borderRadius:8,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                      <p style={{ fontSize:9,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase" }}>Inicio</p>
                                      <p style={{ fontSize:11,fontWeight:600,color:"#0f172a",margin:"1px 0 0" }}>{trip.startedAt ? formatDate(trip.startedAt) : "—"}</p>
                                    </div>
                                    <div style={{ padding:"6px 10px",borderRadius:8,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                      <p style={{ fontSize:9,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase" }}>Fin</p>
                                      <p style={{ fontSize:11,fontWeight:600,color:"#0f172a",margin:"1px 0 0" }}>{trip.completedAt ? formatDate(trip.completedAt) : "—"}</p>
                                    </div>
                                  </div>
                                  {/* Rating */}
                                  {trip.driverRating ? (
                                    <div style={{ padding:"8px 10px",borderRadius:10,background:"#FFFBEB",border:"1px solid #FDE68A",display:"flex",alignItems:"center",gap:8 }}>
                                      <span style={{ fontSize:16 }}>{"⭐".repeat(trip.driverRating)}</span>
                                      {trip.ratingComment && <span style={{ fontSize:11,color:"#92400E",fontStyle:"italic",flex:1 }}>"{trip.ratingComment}"</span>}
                                    </div>
                                  ) : (
                                    <p style={{ fontSize:11,color:"#94a3b8",margin:0,textAlign:"center" }}>Sin evaluación</p>
                                  )}
                                  {/* Notes */}
                                  {trip.notes && (
                                    <div style={{ padding:"6px 10px",borderRadius:8,background:"#f8fafc",border:"1px solid #f1f5f9" }}>
                                      <p style={{ fontSize:9,fontWeight:700,color:"#94a3b8",margin:0,textTransform:"uppercase" }}>Notas</p>
                                      <p style={{ fontSize:11,color:"#334155",margin:"1px 0 0" }}>{trip.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ─── TAB: Cuenta ─── */}
            {activeTab === "cuenta" && (
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                {/* Profile + Photo */}
                <div style={{ background:"#fff",borderRadius:16,border:"1px solid #e2e8f0",padding:"16px 14px",display:"flex",alignItems:"center",gap:14 }}>
                  <div style={{ position:"relative",flexShrink:0 }}>
                    {(driverProfile.photoUrl || (driverProfile.metadata as any)?.photoUrl) ? (
                      <img src={driverProfile.photoUrl || (driverProfile.metadata as any)?.photoUrl} alt="" style={{ width:64,height:64,borderRadius:"50%",objectFit:"cover",border:"3px solid #21D0B3" }} />
                    ) : (
                      <div style={{ width:64,height:64,borderRadius:"50%",background:"linear-gradient(135deg,#21D0B3,#062240)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#fff",border:"3px solid #21D0B3" }}>
                        {(driverProfile.fullName || "C").split(" ").slice(0,2).map((w: string) => w[0] ?? "").join("").toUpperCase()}
                      </div>
                    )}
                    <button type="button" onClick={async () => {
                      const input = document.createElement("input");
                      input.type = "file"; input.accept = "image/*";
                      input.onchange = async () => {
                        const file = input.files?.[0];
                        if (!file || !driverProfile.id) return;
                        setUploadingPhoto(true);
                        try {
                          const dataUrl = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = () => reject(new Error("Error leyendo archivo"));
                            reader.readAsDataURL(file);
                          });
                          if (driverProfile._isParticipant) {
                            await apiFetch(`/provider-participants/${driverProfile.id}/document`, {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ key: "photoUrl", dataUrl }),
                            });
                          } else {
                            await apiFetch(`/drivers/${driverProfile.id}/photo`, {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ dataUrl }),
                            });
                          }
                          const endpoint = driverProfile._isParticipant
                            ? `/provider-participants/${driverProfile.id}`
                            : `/drivers/${driverProfile.id}`;
                          const updated = await apiFetch<Driver>(endpoint);
                          setDriverProfile(updated);
                          driverNotify.push("Foto actualizada", "📷");
                        } catch { driverNotify.push("No se pudo subir la foto", "❌"); }
                        finally { setUploadingPhoto(false); }
                      };
                      input.click();
                    }} disabled={uploadingPhoto}
                      style={{ position:"absolute",bottom:-2,right:-2,width:24,height:24,borderRadius:"50%",background:"#21D0B3",border:"2px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </button>
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <h2 style={{ fontSize:16,fontWeight:800,color:"#0f172a",margin:"0 0 2px" }}>{driverProfile.fullName || "Conductor"}</h2>
                    {driverProfile.rut && <p style={{ fontSize:12,color:"#64748b",margin:0 }}>RUT: {driverProfile.rut}</p>}
                    <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:4 }}>
                      <span style={{ width:7,height:7,borderRadius:"50%",background: driverProfile.status === "ACTIVE" ? "#21D0B3" : "#f59e0b" }} />
                      <span style={{ fontSize:11,color:"#64748b",fontWeight:600 }}>{driverProfile.status === "ACTIVE" ? "Activo" : driverProfile.status || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Credencial digital - generate from template */}
                <div style={{ background:"#fff",borderRadius:16,border:"1px solid #e2e8f0",padding:"14px",overflow:"hidden" }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
                    <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"#21D0B3",margin:0 }}>Credencial</p>
                    <span style={{ fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:6,
                      background: driverProfile.accreditationStatus === "APPROVED" ? "rgba(33,208,179,0.1)" : "rgba(245,158,11,0.1)",
                      color: driverProfile.accreditationStatus === "APPROVED" ? "#0a7a6b" : "#92400e",
                      border: `1px solid ${driverProfile.accreditationStatus === "APPROVED" ? "rgba(33,208,179,0.3)" : "rgba(245,158,11,0.3)"}`,
                    }}>
                      {driverProfile.accreditationStatus === "APPROVED" ? "Aprobada" : driverProfile.accreditationStatus === "CREDENTIAL_ISSUED" ? "Emitida" : driverProfile.accreditationStatus || "Pendiente"}
                    </span>
                  </div>
                  <button type="button" onClick={async () => {
                    try {
                      const eventName = Object.values(events)[0]?.name || "Seven Arena";
                      const prov = driverProfile.providerId ? providers[driverProfile.providerId] : null;
                      const qrData = `Conductor: ${driverProfile.fullName || "—"}\nRUT: ${driverProfile.rut || "—"}\nCódigo: ${driverProfile.credentialCode || driverProfile.id?.slice(-6)}`;
                      const qrDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });
                      const html = buildCredentialHtml({
                        eventName,
                        fullName: driverProfile.fullName || "Conductor",
                        roleLabel: "CONDUCTOR",
                        credentialCode: driverProfile.credentialCode || driverProfile.id?.slice(-6).toUpperCase() || "",
                        statusLabel: driverProfile.accreditationStatus || "PENDING",
                        issuedAtLabel: new Date().toLocaleDateString("es-CL"),
                        issuerLabel: "Seven Arena",
                        subjectId: driverProfile.id || "",
                        providerLabel: prov?.name || "",
                        countryTag: "CHL",
                        accessTypes: driverProfile.accessTypes || [],
                        photoUrl: driverProfile.photoUrl || "",
                        qrDataUrl,
                      });
                      const w = window.open("", "_blank", "width=450,height=700");
                      if (w) { w.document.write(html); w.document.close(); }
                    } catch { driverNotify.push("No se pudo generar la credencial", "❌"); }
                  }}
                    style={{ width:"100%",padding:12,borderRadius:12,border:"none",background:"linear-gradient(135deg,#041a2e,#062240)",color:"#21D0B3",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
                    Ver credencial digital
                  </button>
                </div>

                {/* Info — single card with rows */}
                {(() => {
                  const veh = driverProfile.vehicleId ? vehicles[driverProfile.vehicleId] : null;
                  const meta = driverProfile.metadata ?? {};
                  const plate = veh?.plate || (meta.vehiclePatente as string | null);
                  const vehInfo = [veh?.type || meta.vehicleTipo, veh?.brand || meta.vehicleMarca, veh?.model || meta.vehicleModelo].filter(Boolean).join(" · ");
                  const prov = driverProfile.providerId ? providers[driverProfile.providerId] : null;
                  const rows: { icon: React.ReactNode; label: string; value: string; sub?: string }[] = [
                    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, label: "Correo", value: driverProfile.email || "—" },
                    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>, label: "Teléfono", value: driverProfile.phone || "—" },
                    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2"><path d="M5 17H3v-6l2.5-5h11L19 11v6h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>, label: "Vehículo", value: plate?.toUpperCase() || "Sin asignar", sub: vehInfo || undefined },
                    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>, label: "Proveedor", value: prov?.name || "Sin asignar", sub: prov?.rut ? `RUT: ${prov.rut}` : undefined },
                  ];
                  return (
                    <div style={{ background:"#fff",borderRadius:14,border:"1px solid #e2e8f0",overflow:"hidden" }}>
                      {rows.map((r, i) => (
                        <div key={r.label} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderTop: i > 0 ? "1px solid #f1f5f9" : "none" }}>
                          <span style={{ flexShrink:0 }}>{r.icon}</span>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ display:"flex",alignItems:"baseline",gap:6 }}>
                              <span style={{ fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.08em",flexShrink:0 }}>{r.label}</span>
                              <span style={{ fontSize:13,fontWeight:600,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.value}</span>
                            </div>
                            {r.sub && <p style={{ fontSize:11,color:"#64748b",margin:"1px 0 0" }}>{r.sub}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Documents section */}
                <div style={{ background:"#fff",borderRadius:16,border:"1px solid #e2e8f0",padding:"14px",overflow:"hidden" }}>
                  <p style={{ fontSize:10,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"#21D0B3",margin:"0 0 4px" }}>Documentos</p>
                  <p style={{ fontSize:11,color:"#94a3b8",margin:"0 0 10px" }}>Sube tus documentos desde el celular o galería</p>
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    {([
                      { key: "doc_carnet", label: "Fotocopia Carnet" },
                      { key: "doc_antecedentes", label: "Antecedentes" },
                      { key: "doc_inhabilidades", label: "Cert. Inhabilidades menores" },
                      { key: "doc_licencia", label: "Licencia de conducir" },
                      { key: "doc_foto_carnet", label: "Foto tipo Carnet" },
                      { key: "doc_permiso_circ", label: "Permiso de circulación" },
                      { key: "doc_soap", label: "SOAP" },
                      { key: "doc_decreto_80", label: "Decreto 80" },
                      { key: "doc_padron", label: "Padrón" },
                      { key: "doc_foto_vehiculo", label: "Foto del vehículo" },
                    ]).map((doc) => {
                      const docValue = (driverProfile.metadata as any)?.[doc.key];
                      const uploaded = !!docValue;
                      const isUploading = uploadingDoc === doc.key;
                      return (
                        <div key={doc.key} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9",gap:8 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0 }}>
                            <span style={{ width:7,height:7,borderRadius:"50%",background:uploaded ? "#21D0B3" : "#e2e8f0",flexShrink:0 }} />
                            <span style={{ fontSize:12,fontWeight:500,color:uploaded ? "#0f172a" : "#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{doc.label}</span>
                          </div>
                          <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                            {uploaded && typeof docValue === "string" && (docValue.startsWith("http") || docValue.startsWith("data:")) && (
                              <a href={docValue} target="_blank" rel="noreferrer"
                                style={{ display:"flex",alignItems:"center",justifyContent:"center",width:28,height:28,borderRadius:7,border:"1px solid #e2e8f0",background:"#fff",cursor:"pointer",flexShrink:0 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              </a>
                            )}
                            <button type="button" disabled={isUploading} onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file"; input.accept = "image/*,.pdf";
                              input.onchange = async () => {
                                const file = input.files?.[0];
                                if (!file || !driverProfile.id) return;
                                setUploadingDoc(doc.key);
                                try {
                                  const dataUrl = await new Promise<string>((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onload = () => resolve(reader.result as string);
                                    reader.onerror = () => reject(new Error("Error leyendo archivo"));
                                    reader.readAsDataURL(file);
                                  });
                                  // Upload document to Supabase storage
                                  const endpoint = driverProfile._isParticipant
                                    ? `/provider-participants/${driverProfile.id}/document`
                                    : `/drivers/${driverProfile.id}/document`;
                                  const result = await apiFetch<any>(endpoint, {
                                    method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ key: doc.key, dataUrl }),
                                  });
                                  const newUrl = result?.metadata?.[doc.key] ?? `uploaded_${Date.now()}`;
                                  setDriverProfile({ ...driverProfile, metadata: { ...(driverProfile.metadata || {}), [doc.key]: newUrl } });
                                  driverNotify.push(`${doc.label} cargado`, "📄");
                                } catch (err) { console.error("Doc upload error:", err); driverNotify.push(`Error: ${err instanceof Error ? err.message : "No se pudo subir"} ${doc.label}`, "❌"); }
                                finally { setUploadingDoc(null); }
                              };
                              input.click();
                            }}
                              style={{
                                display:"flex",alignItems:"center",justifyContent:"center",
                                height:28,borderRadius:7,border:"none",cursor: isUploading ? "not-allowed" : "pointer",
                                fontSize:10,fontWeight:600,flexShrink:0,gap:4,
                                padding: uploaded ? "0 8px" : "0 10px",
                                background: uploaded ? "#f1f5f9" : "linear-gradient(135deg,#21D0B3,#14AE98)",
                                color: uploaded ? "#64748b" : "#fff",
                                opacity: isUploading ? 0.5 : 1,
                              }}>
                              {isUploading ? (
                                <span>...</span>
                              ) : uploaded ? (
                                <>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                  Cambiar
                                </>
                              ) : (
                                <>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                  Subir
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* ─── Bottom Tab Bar ─── */}
          <div className="dc-bottom-tabs">
            {([
              { key: "actividades" as const, label: "Actividades", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3v-6l2.5-5h11L19 11v6h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M5 11h14"/></svg> },
              { key: "reportes" as const, label: "Reportes", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
              { key: "cuenta" as const, label: "Cuenta", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
            ]).map((tab) => (
              <button key={tab.key} type="button" className="dc-tab-btn" onClick={() => setActiveTab(tab.key)}
                style={{ color: activeTab === tab.key ? "#21D0B3" : "#94a3b8" }}>
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

        </div>
      )}

      {pickupTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur px-4">
          <div className="surface w-full max-w-md rounded-3xl p-6 shadow-xl">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                {t("Código de verificación")}
              </p>
              <h3 className="font-sans font-bold text-2xl" style={{ color: "var(--text)" }}>
                {pickupTrip && isPortalRequest(pickupTrip) ? t("En curso") : t("Recogido")}
              </h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t("Ingresa el código de usuario del pasajero para iniciar el viaje.")}
              </p>
            </div>
            <label className="flex flex-col gap-2 text-sm mt-4" style={{ color: "var(--text)" }}>
              {t("Código de usuario")}
              <input
                className="input"
                value={pickupCode}
                onChange={(event) => setPickupCode(event.target.value)}
                placeholder="a1b2c3"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                maxLength={12}
              />
            </label>
            {pickupError && <p className="text-sm text-rose-600 mt-2">{pickupError}</p>}
            <div className="flex flex-wrap gap-2 mt-5">
              <button className="btn btn-primary" onClick={submitPickupCode}>
                {t("Validar")}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setPickupTrip(null);
                  setPickupCode("");
                  setPickupError(null);
                }}
              >
                {t("Cancelar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Trip Chat (active trips only) ── */}
      {driverProfile && trackingTripId && (
        <TripChat
          tripId={trackingTripId}
          senderType="DRIVER"
          senderName={driverProfile.fullName || "Conductor"}
          tripStatus={trips.find((t) => t.id === trackingTripId)?.status}
          onNewMessage={(name, content) => driverNotify.push(`${name}: ${content.slice(0, 80)}`, "💬")}
        />
      )}

      {/* ── Asistencia operativa (agente) ── */}
      {driverProfile && (
        <AssistanceChat
          originType="driver"
          originId={driverProfile.id}
          originName={driverProfile.fullName || "Conductor"}
        />
      )}

      {/* ── Location blocked modal ── */}
      {showLocationBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div style={{ background:"#fff",borderRadius:"24px",width:"100%",maxWidth:"380px",padding:"32px 28px",boxShadow:"0 8px 40px rgba(15,23,42,0.2)",textAlign:"center" }}>
            <div style={{ width:"56px",height:"56px",borderRadius:"50%",background:"rgba(239,68,68,0.1)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                <line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444" strokeWidth="2.5"/>
              </svg>
            </div>
            <h3 style={{ fontSize:"18px",fontWeight:800,color:"#0f172a",margin:"0 0 8px" }}>Ubicación no disponible</h3>
            <p style={{ fontSize:"13px",color:"#64748b",lineHeight:1.5,margin:"0 0 8px" }}>
              Para continuar necesitas activar la ubicación en tu navegador.
            </p>
            <div style={{ background:"#f8fafc",borderRadius:"12px",padding:"12px 16px",margin:"0 0 20px",textAlign:"left" }}>
              <p style={{ fontSize:"12px",fontWeight:700,color:"#334155",margin:"0 0 6px" }}>Cómo activarla:</p>
              <p style={{ fontSize:"11px",color:"#64748b",margin:"0 0 4px",lineHeight:1.4 }}>1. Toca el ícono de candado o ajustes en la barra de dirección</p>
              <p style={{ fontSize:"11px",color:"#64748b",margin:"0 0 4px",lineHeight:1.4 }}>2. Busca "Ubicación" o "Location"</p>
              <p style={{ fontSize:"11px",color:"#64748b",margin:0,lineHeight:1.4 }}>3. Cambia a "Permitir" y recarga la página</p>
            </div>
            <div style={{ display:"flex",gap:"10px" }}>
              <button type="button" onClick={() => setShowLocationBlockedModal(false)}
                style={{ flex:1,padding:"12px",borderRadius:"14px",border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",fontSize:"13px",fontWeight:700,cursor:"pointer" }}>
                Cerrar
              </button>
              <button type="button" onClick={() => { setShowLocationBlockedModal(false); window.location.reload(); }}
                style={{ flex:1,padding:"12px",borderRadius:"14px",border:"none",background:"linear-gradient(135deg,#21D0B3,#14AE98)",color:"#fff",fontSize:"13px",fontWeight:700,cursor:"pointer",boxShadow:"0 2px 10px rgba(33,208,179,0.3)" }}>
                Recargar página
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
