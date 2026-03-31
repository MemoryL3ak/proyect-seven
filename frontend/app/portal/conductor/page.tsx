"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";

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
};

type Driver = {
  id: string;
  userId?: string | null;
  fullName?: string | null;
  rut?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  status?: string | null;
  vehicleId?: string | null;
  providerId?: string | null;
  metadata?: Record<string, unknown> | null;
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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [idError, setIdError] = useState<string | null>(null);
  const [pickupTrip, setPickupTrip] = useState<Trip | null>(null);
  const [pickupCode, setPickupCode] = useState("");
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [trackingTripId, setTrackingTripId] = useState<string | null>(null);
  const [driverPosition, setDriverPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [driverToast, setDriverToast] = useState<{ message: string; emoji: string } | null>(null);
  const ratedTripIds = useRef<Set<string>>(new Set());

  const loadTrips = async () => {
    if (!driverId) return;
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
        }));

      const allDrivers: Driver[] = [...(driversData || []), ...participantDrivers];

      const normalizedInput = driverId.trim().toLowerCase();
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

  const requestLocationPermission = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización. El tracking GPS no estará disponible.");
        resolve(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            alert("Debes permitir el acceso a tu ubicación para iniciar el viaje. Activa la ubicación en los ajustes de tu navegador.");
          } else {
            alert("No se pudo obtener tu ubicación. Verifica que el GPS esté activado.");
          }
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const updateTrip = async (tripId: string, status: string) => {
    // Request GPS permission before starting a route
    if (status === "EN_ROUTE") {
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
    if (!trip.vehicleId) return;
    try {
      await apiFetch(`/vehicle-positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(trip.eventId ? { eventId: trip.eventId } : {}),
          vehicleId: trip.vehicleId,
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

  useEffect(() => {
    if (!trackingTripId) return;
    const trip = getTripById(trackingTripId);
    if (!trip) return;

    let interval: number | null = null;
    const tick = () => {
      if (!navigator.geolocation) { console.warn("[GPS] Geolocation no disponible"); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, speed, heading } = pos.coords;
          console.log("[GPS] Posición obtenida:", latitude, longitude);
          sendPosition(trip, latitude, longitude, speed ?? null, heading ?? null);
        },
        (err) => { console.error("[GPS] Error obteniendo posición:", err.code, err.message); },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );
    };

    tick();
    interval = window.setInterval(tick, 5000);
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [trackingTripId, trips]);

  // Continuously watch driver GPS position for live map marker
  useEffect(() => {
    if (!driverProfile || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setDriverPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [driverProfile?.id]);

  // Poll for new ratings on completed trips
  useEffect(() => {
    if (!driverProfile || trips.length === 0) return;
    // Initialize known ratings
    trips.forEach((t) => { if (t.driverRating) ratedTripIds.current.add(t.id); });

    const checkRatings = async () => {
      try {
        const completedIds = trips
          .filter((t) => ["COMPLETED", "DROPPED_OFF"].includes(t.status ?? ""))
          .filter((t) => !ratedTripIds.current.has(t.id))
          .map((t) => t.id);
        for (const id of completedIds) {
          const fresh = await apiFetch<Trip>(`/trips/${id}`);
          if (fresh.driverRating && !ratedTripIds.current.has(id)) {
            ratedTripIds.current.add(id);
            const stars = "⭐".repeat(fresh.driverRating);
            const comment = fresh.ratingComment ? `\n"${fresh.ratingComment}"` : "";
            setDriverToast({ message: `Recibiste ${stars} ${comment}`, emoji: "🌟" });
            setTrips((prev) => prev.map((t) => t.id === id ? fresh : t));
            setTimeout(() => setDriverToast(null), 8000);
          }
        }
      } catch { /* non-blocking */ }
    };

    const interval = setInterval(checkRatings, 10000);
    return () => clearInterval(interval);
  }, [driverProfile?.id, trips.length]);

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
  const filteredTrips = trips.filter((trip) => {
    const matchesType = typeFilter === "all" || trip.tripType === typeFilter;
    const destination = (trip.destination || "").toLowerCase();
    const matchesDestination =
      destinationFilter.trim() === "" ||
      destination.includes(destinationFilter.trim().toLowerCase());
    const status = trip.status ?? "";
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && ["SCHEDULED", "EN_ROUTE", "PICKED_UP"].includes(status)) ||
      (statusFilter === "completed" && ["DROPPED_OFF", "COMPLETED"].includes(status));
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
      {!driverProfile && (
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
                <button type="button" onClick={loadTrips} disabled={loading}
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
            .dc-content{max-width:920px;margin:0 auto;padding:24px 16px 72px;position:relative;z-index:1;}
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
              .dc-content{padding:10px 8px 56px;}
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
              <div className="dc-banner-tag">
                <div style={{ width:6,height:6,borderRadius:"50%",background:"#21D0B3",boxShadow:"0 0 8px #21D0B3",animation:"dc-glow 2s ease-in-out infinite",flexShrink:0 }} />
                <span>{t("Portal de Conductores")}</span>
              </div>
            </div>
          </div>

          <div className="dc-content">

            {/* Toast notification */}
            {driverToast && (
              <div style={{ position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:200,animation:"dc-in .4s cubic-bezier(0.16,1,0.3,1) both",pointerEvents:"none" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,padding:"14px 22px",borderRadius:16,background:"linear-gradient(135deg,#062240,#0a3356)",color:"#fff",fontSize:14,fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,0.3)",whiteSpace:"pre-line",maxWidth:340,textAlign:"center" }}>
                  <span style={{ fontSize:24 }}>{driverToast.emoji}</span>
                  {driverToast.message}
                </div>
              </div>
            )}

            {/* Profile card */}
            <div className="dc-profile-card">
              <div style={{ position:"absolute",left:0,top:0,bottom:0,width:"4px",background:"linear-gradient(180deg,#21D0B3,#1FCDFF,#21D0B3)" }} />
              <div style={{ position:"absolute",top:0,right:0,width:"200px",height:"200px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.05) 0%,transparent 65%)",transform:"translate(60px,-60px)",pointerEvents:"none" }} />
              <div className="dc-profile-body">
                <div style={{ position:"relative",flexShrink:0 }}>
                  {driverProfile.photoUrl ? (
                    <img src={driverProfile.photoUrl} alt="Foto" style={{ width:64,height:64,borderRadius:"50%",objectFit:"cover",boxShadow:"0 6px 24px rgba(33,208,179,0.3)" }} />
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
              <button type="button" onClick={loadTrips} disabled={loading}
                style={{ display:"flex",alignItems:"center",gap:"8px",padding:"10px 16px",borderRadius:"14px",border:"1px solid rgba(33,208,179,0.4)",background:"rgba(33,208,179,0.08)",color:"#21D0B3",fontSize:"13px",fontWeight:600,cursor:"pointer",flexShrink:0,transition:"all .2s",whiteSpace:"nowrap",opacity:loading?0.6:1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
                <span className="dc-btn-text">{t("Actualizar")}</span>
              </button>
              <button type="button" className="dc-logout"
                onClick={() => { setDriverProfile(null); setDriverId(""); setTrips([]); }}
                style={{ display:"flex",alignItems:"center",gap:"8px",padding:"10px 16px",borderRadius:"14px",border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:"13px",fontWeight:600,cursor:"pointer",flexShrink:0,transition:"all .2s",whiteSpace:"nowrap" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span className="dc-btn-text">{t("Cerrar sesión")}</span>
              </button>
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
                  { key: "active", label: "En curso", count: trips.filter((t) => ["SCHEDULED","EN_ROUTE","PICKED_UP"].includes(t.status ?? "")).length },
                  { key: "completed", label: "Finalizados", count: trips.filter((t) => ["DROPPED_OFF","COMPLETED"].includes(t.status ?? "")).length },
                  { key: "all", label: "Todos", count: trips.length },
                ] as const).map(({ key, label, count }) => (
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
                  </button>
                ))}
              </div>

              {filteredTrips.length === 0 ? (
                <div style={{ textAlign:"center",padding:"48px 20px" }}>
                  <div style={{ width:"56px",height:"56px",borderRadius:"16px",background:"rgba(33,208,179,0.08)",border:"1px solid rgba(33,208,179,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",color:"#21D0B3" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3v-6l2.5-5h11L19 11v6h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M5 11h14"/></svg>
                  </div>
                  <p style={{ fontSize:"14px",color:"#94a3b8",margin:0 }}>{t("No hay viajes asignados aún.")}</p>
                </div>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:"12px" }}>
                  {filteredTrips.map((trip, idx) => {
                    const tripEvent = trip.eventId ? events[trip.eventId] : null;
                    const tripVehicle = vehicles[trip.vehicleId];
                    const status = trip.status || "SCHEDULED";
                    const steps = [
                      { key:"SCHEDULED",  label:t("Programado") },
                      { key:"EN_ROUTE",   label:t("En ruta") },
                      { key:"PICKED_UP",  label:t("En curso") },
                      { key:"COMPLETED",  label:t("Completado") },
                    ];
                    const stepOrder = ["SCHEDULED","EN_ROUTE","PICKED_UP","DROPPED_OFF","COMPLETED"];
                    const currentStep = stepOrder.indexOf(status);
                    const stepIdx = (k: string) => {
                      if (k === "COMPLETED") return stepOrder.indexOf("DROPPED_OFF");
                      return stepOrder.indexOf(k);
                    };
                    const isCompleted = status === "COMPLETED" || status === "DROPPED_OFF";
                    return (
                      <div key={trip.id} style={{ background:"#fff",borderRadius:"24px",overflow:"hidden",boxShadow:"0 4px 28px rgba(0,0,0,0.09)",border:"1px solid rgba(226,232,240,0.7)",animation:`dc-in .5s cubic-bezier(0.16,1,0.3,1) both`,animationDelay:`${idx*0.08}s` }}>

                        {/* MAP */}
                        <div style={{ position:"relative" }}>
                          <TripMap origin={trip.origin} destination={trip.destination} driverPosition={driverPosition} height={240} />
                          {/* Status badge overlay */}
                          <div style={{ position:"absolute",top:12,left:12,zIndex:10 }}>
                            <span style={{ display:"inline-flex",alignItems:"center",gap:"6px",padding:"6px 14px",borderRadius:"20px",background: isCompleted?"rgba(33,208,179,0.92)":status==="EN_ROUTE"?"rgba(251,191,36,0.92)":status==="PICKED_UP"?"rgba(139,92,246,0.92)":"rgba(15,23,42,0.78)",color:"#fff",fontSize:"11px",fontWeight:800,letterSpacing:"0.08em",backdropFilter:"blur(6px)",boxShadow:"0 2px 12px rgba(0,0,0,0.2)",textTransform:"uppercase" }}>
                              <span style={{ width:7,height:7,borderRadius:"50%",background:"rgba(255,255,255,0.8)",flexShrink:0,boxShadow: !isCompleted && status!=="COMPLETED"?"0 0 6px rgba(255,255,255,0.9)":"none" }} />
                              {statusLabel[status] || status}
                            </span>
                          </div>
                          {/* Event label */}
                          {tripEvent?.name && (
                            <div style={{ position:"absolute",bottom:12,left:12,right:12,zIndex:10 }}>
                              <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(255,255,255,0.9)",background:"rgba(15,23,42,0.55)",padding:"4px 10px",borderRadius:"8px",backdropFilter:"blur(4px)" }}>{tripEvent.name}</span>
                            </div>
                          )}
                        </div>

                        {/* BODY */}
                        <div style={{ padding:"20px 22px 22px" }}>

                          {/* Progress stepper */}
                          <div style={{ display:"flex",alignItems:"center",marginBottom:"20px" }}>
                            {steps.map((step, si) => {
                              const done = currentStep > stepIdx(step.key);
                              const active = currentStep === stepIdx(step.key);
                              return (
                                <div key={step.key} style={{ display:"flex",alignItems:"center",flex: si < steps.length-1 ? 1 : "none" }}>
                                  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                                    <div style={{ width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background: done||active?"linear-gradient(135deg,#34F3C6,#21D0B3)":"#f1f5f9",border: active?"2px solid #21D0B3":"2px solid transparent",boxShadow: active?"0 0 0 3px rgba(33,208,179,0.25)":done?"0 2px 6px rgba(33,208,179,0.35)":"none",transition:"all .3s",flexShrink:0 }}>
                                      {done
                                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0d1b3e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        : <div style={{ width:8,height:8,borderRadius:"50%",background: active?"#0d1b3e":"#cbd5e1" }} />
                                      }
                                    </div>
                                    <span style={{ fontSize:"9px",fontWeight: active?700:500,color: done||active?"#21D0B3":"#94a3b8",whiteSpace:"nowrap",letterSpacing:"0.04em" }}>{step.label}</span>
                                  </div>
                                  {si < steps.length-1 && (
                                    <div style={{ flex:1,height:2,background: done?"linear-gradient(90deg,#21D0B3,#34F3C6)":"#e2e8f0",margin:"0 4px",marginTop:"-16px",borderRadius:2,transition:"background .3s" }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Route */}
                          <div style={{ display:"flex",gap:"14px",marginBottom:"18px",alignItems:"stretch" }}>
                            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",paddingTop:3 }}>
                              <div style={{ width:12,height:12,borderRadius:"50%",background:"#21D0B3",border:"2px solid white",boxShadow:"0 0 0 2px #21D0B3",flexShrink:0 }} />
                              <div style={{ width:2,flex:1,background:"linear-gradient(180deg,#21D0B3,#ef4444)",margin:"4px 0",minHeight:28,borderRadius:2,opacity:0.4 }} />
                              <div style={{ width:12,height:12,borderRadius:"50%",background:"#ef4444",border:"2px solid white",boxShadow:"0 0 0 2px #ef4444",flexShrink:0 }} />
                            </div>
                            <div style={{ flex:1,display:"flex",flexDirection:"column",justifyContent:"space-between",gap:8 }}>
                              <div>
                                <p style={{ fontSize:"13px",color:"#94a3b8",margin:"0 0 1px",fontWeight:500 }}>{t("Recogida")}</p>
                                <a href={buildMapsLink(trip.origin)} target="_blank" rel="noreferrer" style={{ fontSize:"16px",fontWeight:800,color:"#0f172a",textDecoration:"none",letterSpacing:"-0.01em" }}>{trip.origin || "-"}</a>
                              </div>
                              <div>
                                <p style={{ fontSize:"13px",color:"#94a3b8",margin:"0 0 1px",fontWeight:500 }}>{t("Destino")}</p>
                                <a href={buildMapsLink(trip.destination)} target="_blank" rel="noreferrer" style={{ fontSize:"16px",fontWeight:800,color:"#0f172a",textDecoration:"none",letterSpacing:"-0.01em" }}>{trip.destination || "-"}</a>
                              </div>
                            </div>
                            {trip.scheduledAt && (
                              <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",justifyContent:"center",gap:2,flexShrink:0 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <span style={{ fontSize:"11px",color:"#64748b",fontWeight:600,whiteSpace:"nowrap" }}>{formatDate(trip.scheduledAt)}</span>
                              </div>
                            )}
                          </div>

                          {/* Info chips */}
                          <div style={{ display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"18px" }}>
                            {tripVehicle && (
                              <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:"10px",background:"#f8fafc",border:"1px solid #e2e8f0",fontSize:"11px",fontWeight:600,color:"#334155" }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3v-6l2.5-5h11L19 11v6h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M5 11h14"/></svg>
                                {[tripVehicle.plate,tripVehicle.type,tripVehicle.brand,tripVehicle.model].filter(Boolean).join(" · ").toUpperCase()}
                              </span>
                            )}
                            {trip.tripCost != null && (
                              <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:"10px",background:"#f0fdfb",border:"1px solid rgba(33,208,179,0.25)",fontSize:"11px",fontWeight:700,color:"#0a7a6b" }}>
                                {formatCurrencyCLP(trip.tripCost)}
                              </span>
                            )}
                            {resolveDelegations(trip) !== "-" && (
                              <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:"10px",background:"#f8fafc",border:"1px solid #e2e8f0",fontSize:"11px",fontWeight:600,color:"#334155" }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0112 0v2"/></svg>
                                {resolveDelegations(trip)}
                              </span>
                            )}
                            {resolveDelegationLeads(trip) !== "-" && (
                              <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:"10px",background:"#f8fafc",border:"1px solid #e2e8f0",fontSize:"11px",fontWeight:600,color:"#334155" }}>
                                ⭐ {resolveDelegationLeads(trip)}
                              </span>
                            )}
                            {getTripAthleteIds(trip).length > 0 && (
                              <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:"10px",background:"#f8fafc",border:"1px solid #e2e8f0",fontSize:"11px",fontWeight:600,color:"#334155" }}>
                                {getTripAthleteIds(trip).length} {t("pasajero(s)")}
                              </span>
                            )}
                            {trip.startedAt && (
                              <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:"10px",background:"#f8fafc",border:"1px solid #e2e8f0",fontSize:"11px",color:"#64748b" }}>
                                {t("Inicio")}: {formatDate(trip.startedAt)}
                              </span>
                            )}
                          </div>

                          {/* Action button — status-based, Uber style */}
                          <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
                            {isCompleted ? (
                              <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"14px",borderRadius:"16px",background:"rgba(33,208,179,0.08)",border:"1px solid rgba(33,208,179,0.2)" }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <span style={{ fontSize:"14px",fontWeight:700,color:"#21D0B3" }}>{t("Viaje completado")}</span>
                              </div>
                            ) : status === "SCHEDULED" ? (
                              <button type="button" onClick={() => updateTrip(trip.id, "EN_ROUTE")} disabled={loading}
                                style={{ width:"100%",padding:"16px",borderRadius:"16px",border:"none",background:"linear-gradient(135deg,#34F3C6,#21D0B3)",color:"#0d1b3e",fontSize:"15px",fontWeight:800,cursor:"pointer",boxShadow:"0 4px 16px rgba(33,208,179,0.4)",letterSpacing:"0.01em",display:"flex",alignItems:"center",justifyContent:"center",gap:10,opacity:loading?0.7:1 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                {t("Iniciar — En ruta a recoger")}
                              </button>
                            ) : status === "EN_ROUTE" ? (
                              <>
                                <button type="button" onClick={() => confirmPickup(trip)} disabled={loading}
                                  style={{ width:"100%",padding:"16px",borderRadius:"16px",border:"none",background:"linear-gradient(135deg,#34F3C6,#21D0B3)",color:"#0d1b3e",fontSize:"15px",fontWeight:800,cursor:"pointer",boxShadow:"0 4px 16px rgba(33,208,179,0.4)",letterSpacing:"0.01em",display:"flex",alignItems:"center",justifyContent:"center",gap:10,opacity:loading?0.7:1 }}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                                  {isPortalRequest(trip) ? t("Pasajero recogido — En curso") : t("Pasajero recogido")}
                                </button>
                                <button type="button" className="dc-action-ghost" onClick={() => updateTrip(trip.id, "SCHEDULED")} disabled={loading} style={{ fontSize:"12px",padding:"10px" }}>
                                  {t("← Volver a Programado")}
                                </button>
                              </>
                            ) : status === "PICKED_UP" ? (
                              <button type="button"
                                onClick={() => isPortalRequest(trip) ? updateTrip(trip.id, "COMPLETED") : updateTrip(trip.id, "DROPPED_OFF")}
                                disabled={loading}
                                style={{ width:"100%",padding:"16px",borderRadius:"16px",border:"none",background:"linear-gradient(135deg,#34F3C6,#21D0B3)",color:"#0d1b3e",fontSize:"15px",fontWeight:800,cursor:"pointer",boxShadow:"0 4px 16px rgba(33,208,179,0.4)",letterSpacing:"0.01em",display:"flex",alignItems:"center",justifyContent:"center",gap:10,opacity:loading?0.7:1 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                {isPortalRequest(trip) ? t("Finalizar viaje") : t("Llegamos al destino")}
                              </button>
                            ) : status === "DROPPED_OFF" ? (
                              <button type="button" onClick={() => updateTrip(trip.id, "COMPLETED")} disabled={loading}
                                style={{ width:"100%",padding:"16px",borderRadius:"16px",border:"none",background:"linear-gradient(135deg,#34F3C6,#21D0B3)",color:"#0d1b3e",fontSize:"15px",fontWeight:800,cursor:"pointer",boxShadow:"0 4px 16px rgba(33,208,179,0.4)",letterSpacing:"0.01em",display:"flex",alignItems:"center",justifyContent:"center",gap:10,opacity:loading?0.7:1 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                {t("Confirmar viaje completado")}
                              </button>
                            ) : null}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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
    </>
  );
}


