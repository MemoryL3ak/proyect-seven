"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";

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
  const [destinationFilter, setDestinationFilter] = useState("");
  const [idError, setIdError] = useState<string | null>(null);
  const [pickupTrip, setPickupTrip] = useState<Trip | null>(null);
  const [pickupCode, setPickupCode] = useState("");
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [trackingTripId, setTrackingTripId] = useState<string | null>(null);

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
        providersData
      ] = await Promise.all([
        apiFetch<Trip[]>("/trips"),
        apiFetch<Driver[]>("/drivers"),
        apiFetch<EventItem[]>("/events"),
        apiFetch<VehicleItem[]>("/transports"),
        apiFetch<DelegationItem[]>("/delegations"),
        apiFetch<AthleteItem[]>("/athletes"),
        apiFetch<ProviderItem[]>("/providers")
      ]);

      const normalizedInput = driverId.trim();
      const driverMatch = (driversData || []).find((driver) => {
        const id = driver.id ?? "";
        const userId = driver.userId ?? "";
        const last6 = id.slice(-6);
        const last6User = userId.slice(-6);
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

      const driverKeys = new Set(
        [driverMatch?.id, driverMatch?.userId].filter(
          (value): value is string => Boolean(value)
        )
      );
      const filteredTrips = (tripsData || []).filter((trip) => driverKeys.has(trip.driverId));
      setTrips(filteredTrips);

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

  const updateTrip = async (tripId: string, status: string) => {
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
    const last6 = normalized.slice(-6);
    const candidates = getPickupCandidates(pickupTrip);
    if (!candidates.has(last6)) {
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
    if (!trip.eventId) return;
    try {
      await apiFetch(`/vehicle-positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: trip.eventId,
          vehicleId: trip.vehicleId,
          timestamp: new Date().toISOString(),
          location: { type: "Point", coordinates: [longitude, latitude] },
          speed,
          heading
        })
      });
    } catch (err) {
      // non-blocking
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
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, speed, heading } = pos.coords;
          sendPosition(trip, latitude, longitude, speed ?? null, heading ?? null);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );
    };

    tick();
    interval = window.setInterval(tick, 5000);
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [trackingTripId, trips]);


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

  const resolveDelegationLeads = (trip: Trip) => {
    const ids = (trip.athleteIds || [])
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
    const names = (trip.athleteIds || [])
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
    return matchesType && matchesDestination;
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
        <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ background: "var(--elevated)" }}>
          <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-[30px] p-6 shadow-sm space-y-4" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>{t("Perfil")}</p>
                  <h2 className="font-sans font-bold text-2xl mt-1" style={{ color: "var(--text)" }}>
                    {driverProfile?.fullName || t("Conductor")}
                  </h2>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>RUT: {driverProfile?.rut || "-"}</p>
                </div>
                {driverProfile?.photoUrl ? (
                  <img
                    src={driverProfile.photoUrl}
                    alt={t("Foto conductor")}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full flex items-center justify-center text-xs" style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-faint)" }}>
                    {t("Sin foto")}
                  </div>
                )}
              </div>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setDriverProfile(null);
                  setDriverId("");
                  setTrips([]);
                }}
              >
                {t("Volver")}
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl p-4" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>{t("Correo")}</p>
                <p className="text-sm font-medium mt-1" style={{ color: "var(--text)" }}>{driverProfile?.email || "-"}</p>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>{t("ID de conductor")}</p>
                <p className="text-sm font-medium mt-1" style={{ color: "var(--text)" }}>{driverProfile?.userId || driverProfile?.id || "-"}</p>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>{t("Vehículo")}</p>
                <p className="text-sm font-medium mt-1" style={{ color: "var(--text)" }}>
                  {(() => {
                    const vehicle = driverProfile?.vehicleId ? vehicles[driverProfile.vehicleId] : null;
                    if (!vehicle) return "-";
                    const parts = [vehicle.plate, vehicle.type, vehicle.brand, vehicle.model]
                      .filter(Boolean)
                      .join(" · ");
                    return parts || "-";
                  })()}
                </p>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>{t("Proveedor")}</p>
                <p className="text-sm font-medium mt-1" style={{ color: "var(--text)" }}>
                  {(() => {
                    const provider = driverProfile?.providerId ? providers[driverProfile.providerId] : null;
                    if (!provider) return "-";
                    const label = provider.name || provider.id || "-";
                    return provider.rut ? `${label} · ${provider.rut}` : label;
                  })()}
                </p>
              </div>
            </div>
          </section>
          </div>
        </div>
      )}

      {driverProfile && (
          <section className="rounded-[30px] p-6 shadow-sm" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-sans font-bold text-2xl" style={{ color: "var(--text)" }}>{t("Viajes asignados")}</h2>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                {t("Tipo")}
                <select
                  className="input h-9 min-w-[140px] pr-10 !text-[12px] !leading-tight !pt-[0.4rem] !pb-[0.2rem]"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="all">{t("Todos")}</option>
                  {typeOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                {t("Destino")}
                <input
                  className="input h-9"
                  value={destinationFilter}
                  onChange={(event) => setDestinationFilter(event.target.value)}
                  placeholder={t("Filtrar por destino")}
                />
              </label>
            </div>
          </div>
          {filteredTrips.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("No hay viajes asignados aún.")}</p>
          ) : (
            <div className="space-y-4">
              {filteredTrips.map((trip) => {
                const event = trip.eventId ? events[trip.eventId] : null;
                const vehicle = vehicles[trip.vehicleId];
                return (
                  <div key={trip.id} className="rounded-2xl p-4 space-y-3" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>{t("Viaje")}</p>
                        <p className="text-sm" style={{ color: "var(--text)" }}>{trip.id}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {t("Evento")}: {event?.name || trip.eventId || "-"}
                        </p>
                      </div>
                      <div className="badge badge-amber">
                        {statusLabel[trip.status || "SCHEDULED"] || trip.status}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {t("Vehículo")}: {vehicle?.plate || trip.vehicleId}
                        {vehicle?.type ? ` (${vehicle.type})` : ""}
                        {vehicle?.brand || vehicle?.model
                          ? ` · ${[vehicle?.brand, vehicle?.model].filter(Boolean).join(" ")}`
                          : ""}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {t("Programación")}: {formatDate(trip.scheduledAt)}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {t("Costo de viaje")}: {formatCurrencyCLP(trip.tripCost)}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {t("Origen")}:{" "}
                        {trip.origin ? (
                          <a
                            className="hover:underline"
                            style={{ color: "var(--brand)" }}
                            href={buildMapsLink(trip.origin)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {trip.origin}
                          </a>
                        ) : (
                          "-"
                        )}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {t("Destino")}:{" "}
                        {trip.destination ? (
                          <a
                            className="hover:underline"
                            style={{ color: "var(--brand)" }}
                            href={buildMapsLink(trip.destination)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {trip.destination}
                          </a>
                        ) : (
                          "-"
                        )}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("Delegación")}: {resolveDelegations(trip)}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("Encargado de delegaci\u00f3n")}: {resolveDelegationLeads(trip)}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("Participantes")}: {(trip.athleteIds || []).length}</div>
                    </div>

                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {t("Inicio")}: {formatDate(trip.startedAt)} | {t("Cierre")}: {formatDate(trip.completedAt)}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-ghost" onClick={() => updateTrip(trip.id, "EN_ROUTE")}>
                        {t("En ruta a recoger")}
                      </button>
                      <button className="btn btn-primary" onClick={() => confirmPickup(trip)}>
                        {isPortalRequest(trip) ? t("En curso") : t("Recogido")}
                      </button>
                      {!isPortalRequest(trip) && trip.tripType !== "SERVICE" && (
                        <button className="btn btn-primary" onClick={() => updateTrip(trip.id, "DROPPED_OFF")}>
                          {t("Dejado en hotel")}
                        </button>
                      )}
                      <button className="btn btn-ghost" onClick={() => updateTrip(trip.id, "COMPLETED")}>
                        {t("Viaje completado")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
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
                placeholder="000000"
                inputMode="numeric"
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


