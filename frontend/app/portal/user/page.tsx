"use client";

import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import TripMap from "@/components/TripMap";
import NotificationBell, { useNotifications } from "@/components/NotificationBell";
import TripChat from "@/components/TripChat";

type Athlete = {
  id: string;
  fullName: string;
  userType?: string | null;
  countryCode?: string | null;
  status?: string | null;
  eventId?: string | null;
  delegationId?: string | null;
  arrivalFlightId?: string | null;
  flightNumber?: string | null;
  airline?: string | null;
  origin?: string | null;
  arrivalTime?: string | null;
  airportCheckinAt?: string | null;
  hotelAccommodationId?: string | null;
  roomNumber?: string | null;
  roomType?: string | null;
  bedType?: string | null;
  luggageType?: string | null;
  hotelCheckinAt?: string | null;
  hotelCheckoutAt?: string | null;
  transportTripId?: string | null;
  transportVehicleId?: string | null;
};

type Flight = { id: string; flightNumber: string; airline: string; arrivalTime: string | null };
type Hotel = { id: string; name: string };
type HotelAssignment = {
  id: string;
  participantId?: string; participant_id?: string;
  hotelId?: string; hotel_id?: string;
  roomId?: string | null; room_id?: string | null;
  bedId?: string | null; bed_id?: string | null;
  checkinAt?: string | null; checkin_at?: string | null;
  checkoutAt?: string | null; checkout_at?: string | null;
  createdAt?: string; created_at?: string;
  updatedAt?: string; updated_at?: string;
};
type HotelRoom = { id: string; roomNumber: string; roomType: string };
type HotelBed = { id: string; bedType: string };
type Vehicle = { id: string; plate: string; type: string };
type Trip = { id: string; driverId: string; vehicleId?: string | null; athleteIds?: string[]; requesterAthleteId?: string | null; clientType?: string | null; origin?: string | null; destination?: string | null; status?: string | null; scheduledAt?: string | null; startedAt?: string | null; completedAt?: string | null; tripType?: string | null; notes?: string | null; driverRating?: number | null; ratingComment?: string | null; ratedAt?: string | null; passengerLat?: number | null; passengerLng?: number | null };
type Driver = { id: string; fullName: string; userId?: string | null };
type Event = { id: string; name: string };
type Delegation = { id: string; countryCode: string };

const countryLabels: Record<string, string> = {
  ARG:"Argentina",BOL:"Bolivia",BRA:"Brasil",CHL:"Chile",COL:"Colombia",
  ECU:"Ecuador",PRY:"Paraguay",PER:"Perú",URY:"Uruguay",VEN:"Venezuela",
  MEX:"México",USA:"Estados Unidos",CAN:"Canadá",ESP:"España",FRA:"Francia",
  DEU:"Alemania",ITA:"Italia",PRT:"Portugal",GBR:"Reino Unido"
};
const luggageLabels: Record<string, string> = {
  BAG:"Bolso",SUITCASE_8:"Maleta 8kg",SUITCASE_15:"Maleta 15kg",
  SUITCASE_23:"Maleta 23kg",EXTRA_BAGGAGE:"Sobreequipaje"
};

const fmt = (v?: string | null) =>
  v && v !== "null" && v !== "undefined" && !Number.isNaN(new Date(v).getTime())
    ? new Date(v).toLocaleString("es-CL", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })
    : null;

const normalizeHA = (item: HotelAssignment) => ({
  id: item.id,
  participantId: item.participantId ?? item.participant_id ?? "",
  hotelId: item.hotelId ?? item.hotel_id ?? "",
  roomId: item.roomId ?? item.room_id ?? null,
  bedId: item.bedId ?? item.bed_id ?? null,
  checkinAt: item.checkinAt === "null" || item.checkin_at === "null" ? null : (item.checkinAt ?? item.checkin_at ?? null),
  checkoutAt: item.checkoutAt === "null" || item.checkout_at === "null" ? null : (item.checkoutAt ?? item.checkout_at ?? null),
  createdAt: item.createdAt ?? item.created_at ?? "",
  updatedAt: item.updatedAt ?? item.updated_at ?? ""
});

/* ── Icons ── */
const IcoPlane = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 1 16.5 2.5L13 6 4.8 4.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 5.2 5.3c.4.4.9.4 1.3.3l.5-.3c.4-.3.6-.7.5-1.1z"/>
  </svg>
);
const IcoHotel = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14"/><path d="M3 21h18"/><path d="M9 21V12h6v9"/><rect x="9" y="7" width="2" height="2"/><rect x="13" y="7" width="2" height="2"/>
  </svg>
);
const IcoCar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3v-6l2.5-5h11L19 11v6h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M5 11h14"/>
  </svg>
);
const IcoCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);
const IcoLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IcoBag = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
  </svg>
);

export default function UserPortalPage() {
  const { t } = useI18n();
  const [athleteId, setAthleteId] = useState("");
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [hotelAssignment, setHotelAssignment] = useState<HotelAssignment | null>(null);
  const [hotelRoom, setHotelRoom] = useState<HotelRoom | null>(null);
  const [hotelBed, setHotelBed] = useState<HotelBed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [markLoading, setMarkLoading] = useState<string | null>(null);
  const [showTripModal, setShowTripModal] = useState(false);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const [driverEta, setDriverEta] = useState<{ distance: string; duration: string } | null>(null);
  const notify = useNotifications();
  const prevTripStatus = useRef<string | null>(null);
  const arrivedNotified = useRef<string | null>(null); // tracks which segment was already notified

  const loadAthlete = async () => {
    if (!athleteId) return;
    setLoading(true);
    setError(null);
    try {
      const normalizedInput = athleteId.trim().toLowerCase();
      if (normalizedInput.length < 6) { setError(t("El código ingresado no es válido.")); return; }
      const list = await apiFetch<Athlete[]>(`/athletes`);
      const validatedAthletes = filterValidatedAthletes(list || []);
      const match = validatedAthletes.find((a) => a.id?.slice(-6).toLowerCase() === normalizedInput);
      if (!match) { setError(t("El código ingresado no corresponde a un usuario registrado.")); return; }
      const data = await apiFetch<Athlete>(`/athletes/${match.id}`);

      if (data.userType === "VIP") {
        window.location.href = `/portal/vehicle-request?athleteId=${data.id}`;
        return;
      }

      setAthlete(data);

      const [flightData, hotelData, vehicleData, tripData, tripsList, eventData, delegationData, assignmentData] = await Promise.all([
        data.arrivalFlightId ? apiFetch<Flight>(`/flights/${data.arrivalFlightId}`) : Promise.resolve(null),
        data.hotelAccommodationId ? apiFetch<Hotel>(`/accommodations/${data.hotelAccommodationId}`) : Promise.resolve(null),
        data.transportVehicleId ? apiFetch<Vehicle>(`/transports/${data.transportVehicleId}`) : Promise.resolve(null),
        data.transportTripId ? apiFetch<Trip>(`/trips/${data.transportTripId}`) : Promise.resolve(null),
        data.transportTripId ? Promise.resolve([]) : apiFetch<Trip[]>(`/trips?requesterAthleteId=${data.id}`),
        data.eventId ? apiFetch<Event>(`/events/${data.eventId}`) : Promise.resolve(null),
        data.delegationId ? apiFetch<Delegation>(`/delegations/${data.delegationId}`) : Promise.resolve(null),
        apiFetch<HotelAssignment | null>(`/hotel-assignments/by-participant/${data.id}`)
      ]);

      const assignment = assignmentData ? normalizeHA(assignmentData) : null;
      setFlight(flightData); setHotelAssignment(assignment); setEvent(eventData); setDelegation(delegationData);

      let resolvedHotel = hotelData;
      if (assignment?.hotelId && (!resolvedHotel || resolvedHotel.id !== assignment.hotelId)) {
        try { resolvedHotel = await apiFetch<Hotel>(`/accommodations/${assignment.hotelId}`); } catch { resolvedHotel = resolvedHotel ?? null; }
      }
      setHotel(resolvedHotel);

      const inferredTrip = tripData ?? (tripsList || []).find((t) => t.requesterAthleteId === data.id || (t.athleteIds || []).includes(data.id)) ?? null;
      setTrip(inferredTrip);

      let resolvedVehicle = vehicleData;
      if (inferredTrip?.vehicleId && !vehicleData) {
        try { resolvedVehicle = await apiFetch<Vehicle>(`/transports/${inferredTrip.vehicleId}`); } catch { resolvedVehicle = null; }
      }
      setVehicle(resolvedVehicle);

      let resolvedDriver: Driver | null = null;
      if (inferredTrip?.driverId) {
        try {
          const [drivers, participants] = await Promise.all([
            apiFetch<Driver[]>(`/drivers`),
            apiFetch<any[]>(`/provider-participants`).catch(() => []),
          ]);
          resolvedDriver = (drivers || []).find((d) => d.id === inferredTrip.driverId || d.userId === inferredTrip.driverId) ?? null;
          if (!resolvedDriver) {
            const p = (participants || []).find((pp) => pp.id === inferredTrip.driverId);
            if (p) resolvedDriver = { id: p.id, fullName: p.fullName, userId: null };
          }
        } catch { resolvedDriver = null; }
      }
      setDriver(resolvedDriver);

      if (assignment?.roomId) {
        try { setHotelRoom(await apiFetch<HotelRoom>(`/hotel-rooms/${assignment.roomId}`)); } catch { setHotelRoom(null); }
      } else { setHotelRoom(null); }

      if (assignment?.bedId) {
        try { setHotelBed(await apiFetch<HotelBed>(`/hotel-beds/${assignment.bedId}`)); } catch { setHotelBed(null); }
      } else { setHotelBed(null); }

    } catch (err) {
      let message = err instanceof Error ? err.message : "";
      try { const p = JSON.parse(message); if (p?.message) message = p.message; } catch {}
      setError(message || t("No se pudo cargar"));
      setFlight(null); setHotel(null); setVehicle(null); setDriver(null); setTrip(null);
      setEvent(null); setDelegation(null); setHotelAssignment(null); setHotelRoom(null); setHotelBed(null);
    } finally { setLoading(false); }
  };

  const mark = async (field: "airportCheckinAt" | "hotelCheckinAt" | "hotelCheckoutAt") => {
    if (!athlete) return;
    setMarkLoading(field);
    setError(null);
    try {
      const now = new Date().toISOString();
      const updated = await apiFetch<Athlete>(`/athletes/${athlete.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: now })
      });
      setAthlete(updated);
      if (hotelAssignment?.id && (field === "hotelCheckinAt" || field === "hotelCheckoutAt")) {
        const ap = field === "hotelCheckinAt" ? { checkinAt: now } : { checkoutAt: now };
        try { await apiFetch(`/hotel-assignments/${hotelAssignment.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ap) }); } catch {}
        setHotelAssignment((prev) => prev ? { ...prev, ...(field === "hotelCheckinAt" ? { checkinAt: now } : { checkoutAt: now }) } : prev);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo actualizar"));
    } finally { setMarkLoading(null); }
  };

  const requestAccess = async () => {
    if (!requestEmail) return;
    setRequestLoading(true); setRequestError(null); setRequestStatus(null);
    try {
      const response = await apiFetch<{ message?: string }>(`/athletes/request-access`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: requestEmail })
      });
      setRequestStatus(response?.message || t("Código enviado al correo"));
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      let message = raw;
      try { const p = JSON.parse(raw); if (p?.message) message = p.message; } catch {}
      if (message.includes("encargado de delegación") || message.includes("participante registrado")) {
        message = t("El correo ingresado no está autorizado para solicitar el código.");
      }
      setRequestError(message || t("No se pudo actualizar"));
    } finally { setRequestLoading(false); }
  };

  const submitRating = async () => {
    if (!trip || ratingStars === 0) return;
    setRatingLoading(true);
    try {
      await apiFetch(`/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverRating: ratingStars,
          ratingComment: ratingComment.trim() || undefined,
          ratedAt: new Date().toISOString(),
        }),
      });
      setTrip({ ...trip, driverRating: ratingStars });
      notify.push("¡Gracias por tu evaluación!", "⭐");
      setShowRating(false);
      setRatingStars(0);
      setRatingComment("");
    } catch {
      notify.push("No se pudo enviar la evaluación", "❌");
    } finally {
      setRatingLoading(false);
    }
  };

  /* ─── trip polling + driver ETA + notifications ─── */
  const notifyStatusChange = (status: string) => {
    const msgs: Record<string, { message: string; emoji: string }> = {
      EN_ROUTE:    { message: "El conductor está en camino a recogerte", emoji: "🚗" },
      PICKED_UP:   { message: "¡Estás en ruta a tu destino!", emoji: "✅" },
      DROPPED_OFF: { message: "Has llegado a tu destino", emoji: "🏁" },
      COMPLETED:   { message: "Viaje completado", emoji: "🎉" },
      SCHEDULED:   { message: "Tu traslado fue programado", emoji: "📅" },
    };
    const info = msgs[status];
    if (!info) return;
    notify.push(info.message, info.emoji);
  };

  const calculateEta = (
    driverLatLng: { lat: number; lng: number },
    tripStatus: string | null | undefined,
    tripOrigin: string | null | undefined,
    tripDestination: string | null | undefined,
  ) => {
    const google = (window as any).google;
    if (!google?.maps?.DistanceMatrixService) return;

    // EN_ROUTE → conductor va al punto de recogida (origin)
    // PICKED_UP → conductor va al destino final
    const target = tripStatus === "EN_ROUTE" ? tripOrigin : tripDestination;
    if (!target) return;

    const segmentKey = `${tripStatus}`;
    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      { origins: [driverLatLng], destinations: [target], travelMode: "DRIVING" },
      (response: any, status: string) => {
        if (status !== "OK") return;
        const el = response?.rows?.[0]?.elements?.[0];
        if (el?.status !== "OK") return;
        setDriverEta({ distance: el.distance.text, duration: el.duration.text });

        // Notificación de proximidad: < 3 minutos y aún no notificamos este tramo
        const durationSecs: number = el.duration.value;
        if (durationSecs <= 180 && arrivedNotified.current !== segmentKey) {
          arrivedNotified.current = segmentKey;
          if (tripStatus === "EN_ROUTE") {
            notify.push("El conductor está llegando a recogerte", "🚖");
          } else if (tripStatus === "PICKED_UP") {
            notify.push("Estás llegando a tu destino", "📍");
          }
        }
      }
    );
  };

  // Show rating when trip completes (outside polling, catches any missed state)
  useEffect(() => {
    if (!trip) return;
    if ((trip.status === "COMPLETED" || trip.status === "DROPPED_OFF") && !trip.driverRating) {
      setShowRating(true);
    }
  }, [trip?.status]);

  useEffect(() => {
    if (!trip) return;
    const activeStatuses = ["SCHEDULED", "EN_ROUTE", "PICKED_UP"];
    if (!activeStatuses.includes(trip.status ?? "")) return;

    // Request browser notification permission once
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    prevTripStatus.current = trip.status ?? null;
    arrivedNotified.current = null;

    const poll = async () => {
      try {
        const updated = await apiFetch<Trip>(`/trips/${trip.id}`);
        if (updated.status !== prevTripStatus.current) {
          const prev = prevTripStatus.current;
          prevTripStatus.current = updated.status ?? null;
          arrivedNotified.current = null; // reset proximity alert for the new segment
          notifyStatusChange(updated.status ?? "");
          setTrip(updated);
          // Show rating popup when trip completes (and hasn't been rated yet)
          if ((updated.status === "COMPLETED" || updated.status === "DROPPED_OFF") && !updated.driverRating) {
            setShowRating(true);
          }
        }

        const vehicleId = updated.vehicleId ?? trip.vehicleId;
        if (vehicleId) {
          const pos = await apiFetch<any>(`/vehicle-positions/by-vehicle/${vehicleId}`).catch(() => null);
          if (pos?.location) {
            const loc = pos.location as any;
            // GeoJSON Point: { coordinates: [lng, lat] }
            // or flat object: { lat, lng } or { latitude, longitude }
            let latLng: { lat: number; lng: number } | null = null;
            if (Array.isArray(loc?.coordinates) && loc.coordinates.length >= 2) {
              latLng = { lat: loc.coordinates[1] as number, lng: loc.coordinates[0] as number };
            } else if (typeof loc?.lat === "number" && typeof loc?.lng === "number") {
              latLng = { lat: loc.lat, lng: loc.lng };
            } else if (typeof loc?.latitude === "number" && typeof loc?.longitude === "number") {
              latLng = { lat: loc.latitude, lng: loc.longitude };
            }
            if (latLng) {
              setDriverPos(latLng);
              if (updated.status === "EN_ROUTE" || updated.status === "PICKED_UP") {
                calculateEta(
                  latLng,
                  updated.status,
                  updated.origin ?? trip.origin,
                  updated.destination ?? trip.destination,
                );
              } else {
                setDriverEta(null);
              }
            }
          }
        }
      } catch {
        // non-blocking
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, trip?.status]);

  /* ─── user geolocation + send to backend ─── */
  useEffect(() => {
    if (!athlete || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(coords);
        // Send position to backend so the conductor can see us
        if (trip?.id && ["EN_ROUTE", "PICKED_UP"].includes(trip.status ?? "")) {
          apiFetch(`/trips/${trip.id}/passenger-position`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(coords),
          }).catch(() => {});
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [athlete?.id]);

  /* ─── helpers ─── */
  const initials = athlete?.fullName
    ? athlete.fullName.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase()
    : "?";

  const checkins = [
    { key: "airportCheckinAt" as const, label: t("Aeropuerto"), ts: athlete?.airportCheckinAt },
    { key: "hotelCheckinAt" as const, label: t("Hotel check-in"), ts: athlete?.hotelCheckinAt },
    { key: "hotelCheckoutAt" as const, label: t("Hotel check-out"), ts: athlete?.hotelCheckoutAt },
  ];

  /* ══════════════════════════════════════════════════════════
     LOGIN SCREEN
  ══════════════════════════════════════════════════════════ */
  if (!athlete) return (
    <div className="flex flex-col lg:flex-row" style={{ minHeight: "100vh", background: "#020c18", position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes pu-f1{0%,100%{transform:translateY(0px) scale(1)}50%{transform:translateY(-30px) translateX(10px) scale(1.05)}}
        @keyframes pu-f2{0%,100%{transform:translateY(0px)}50%{transform:translateY(-20px) translateX(15px)}}
        @keyframes pu-pulse{0%,100%{opacity:0.15;transform:scale(1)}50%{opacity:0.4;transform:scale(1.08)}}
        @keyframes pu-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes pu-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .pu-form{animation:pu-in 0.6s cubic-bezier(0.16,1,0.3,1) both;animation-delay:0.15s;opacity:0;}
        .pu-input:focus{border-color:rgba(33,208,179,0.6)!important;box-shadow:0 0 0 3px rgba(33,208,179,0.12)!important;}
        @media(max-width:640px){
          .pu-form{padding:0 4px;}
          .pu-input{padding:14px!important;font-size:16px!important;}
        }
      `}</style>

      {/* Left branding */}
      <div className="flex flex-col justify-between p-8 lg:p-14 lg:w-[46%] lg:flex-shrink-0"
        style={{ background: "linear-gradient(160deg,#020c18 0%,#041a2e 40%,#062240 70%,#030f1e 100%)", position: "relative", overflow: "hidden", minHeight: "180px" }}>
        <div style={{ position:"absolute",inset:0,pointerEvents:"none",backgroundImage:`linear-gradient(rgba(33,208,179,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.03) 1px,transparent 1px)`,backgroundSize:"60px 60px" }} />
        <div style={{ position:"absolute",top:"-60px",left:"-60px",width:"400px",height:"400px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(6,34,64,0.6) 0%,transparent 70%)",animation:"pu-f1 12s ease-in-out infinite",pointerEvents:"none" }} />
        <div style={{ position:"absolute",bottom:"60px",right:"-40px",width:"320px",height:"320px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.1) 0%,transparent 70%)",animation:"pu-f2 16s ease-in-out infinite",pointerEvents:"none" }} />
        {[480,340,200].map((size,i) => (
          <div key={i} style={{ position:"absolute",top:"50%",left:"50%",marginTop:-size/2,marginLeft:-size/2,width:size,height:size,borderRadius:"50%",border:`1px solid rgba(33,208,179,${0.04+i*0.04})`,animation:`pu-pulse 6s ease-in-out infinite ${i*2}s`,pointerEvents:"none" }} />
        ))}
        <div style={{ position:"relative",zIndex:1 }}>
          <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" className="h-14 sm:h-20 lg:h-28" style={{ width:"auto",objectFit:"contain",filter:"drop-shadow(0 0 30px rgba(33,208,179,0.4)) drop-shadow(0 4px 12px rgba(0,0,0,0.9))" }} />
        </div>
        <div style={{ position:"relative",zIndex:1,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:"16px",padding:"24px 0" }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:"8px",width:"fit-content" }}>
            <span style={{ width:7,height:7,borderRadius:"50%",background:"#21D0B3",boxShadow:"0 0 10px #21D0B3",display:"inline-block",animation:"pu-pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#21D0B3" }}>Portal de Participantes</span>
          </div>
          <h1 style={{ fontSize:"clamp(28px,3vw,44px)",fontWeight:800,lineHeight:1.1,color:"#f8fafc",letterSpacing:"-0.02em",margin:0 }}>
            Tu itinerario<br />
            <span style={{ background:"linear-gradient(90deg,#21D0B3 0%,#34F3C6 40%,#21D0B3 80%)",backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",animation:"pu-shimmer 4s linear infinite" }}>en tiempo real</span>
          </h1>
          <p className="hidden sm:block" style={{ fontSize:"14px",color:"rgba(255,255,255,0.45)",maxWidth:"340px",lineHeight:1.7,margin:0 }}>
            Accede a tu vuelo, hotel y transporte asignado. Confirma cada etapa de tu llegada al evento.
          </p>
          <div className="hidden lg:flex flex-col" style={{ gap:"10px",marginTop:"8px" }}>
            {([
              [<IcoPlane key="p"/>, "Información de vuelo"],
              [<IcoHotel key="h"/>, "Hotel y habitación"],
              [<IcoCar key="c"/>, "Transporte asignado"],
            ] as [React.ReactNode, string][]).map(([icon, label]) => (
              <div key={label} style={{ display:"flex",alignItems:"center",gap:"10px",color:"rgba(33,208,179,0.8)" }}>
                {icon}
                <span style={{ fontSize:"13px",color:"rgba(255,255,255,0.6)",fontWeight:500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden lg:flex" style={{ position:"relative",zIndex:1,borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:"20px" }}>
          {[["Acceso seguro","SSL / HTTPS"],["Datos live","Tiempo real"],["Multi-evento","Global"]].map(([title,sub],i,arr) => (
            <div key={title} style={{ flex:1,paddingRight:i<arr.length-1?"20px":"0",borderRight:i<arr.length-1?"1px solid rgba(255,255,255,0.06)":"none",paddingLeft:i>0?"20px":"0" }}>
              <p style={{ fontSize:"14px",fontWeight:800,color:"#21D0B3",margin:0,lineHeight:1 }}>{title}</p>
              <p style={{ fontSize:"10px",color:"rgba(255,255,255,0.32)",margin:"3px 0 0",letterSpacing:"0.05em",textTransform:"uppercase" }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8 lg:p-16"
        style={{ background:"linear-gradient(160deg,#030f1e 0%,#041a2e 50%,#020c18 100%)",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:"30%",left:"50%",transform:"translate(-50%,-50%)",width:"500px",height:"500px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(6,34,64,0.4) 0%,transparent 70%)",pointerEvents:"none" }} />
        <div style={{ position:"absolute",bottom:"-50px",right:"-50px",width:"280px",height:"280px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.08) 0%,transparent 70%)",pointerEvents:"none" }} />
        <div className="pu-form relative z-10 w-full" style={{ maxWidth:"420px" }}>
          <h2 style={{ fontSize:"24px",fontWeight:700,color:"rgba(255,255,255,0.95)",marginBottom:"6px" }}>{t("Acceder al portal")}</h2>
          <p style={{ fontSize:"13px",color:"rgba(255,255,255,0.4)",marginBottom:"28px",lineHeight:1.6 }}>
            {t("Ingresa tu código de participante para ver tu información asignada.")}
          </p>
          <div style={{ display:"grid",gap:"12px" }}>
            <div>
              <span style={{ fontSize:"11px",fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",display:"block",marginBottom:"8px" }}>{t("Código de acceso")}</span>
              <input className="pu-input" value={athleteId} onChange={(e) => setAthleteId(e.target.value)} onKeyDown={(e) => e.key==="Enter" && loadAthlete()}
                placeholder={t("Ingresa tu código")}
                style={{ width:"100%",padding:"16px",borderRadius:"14px",border:"1px solid rgba(33,208,179,0.2)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.9)",fontSize:"15px",outline:"none",fontWeight:500,boxSizing:"border-box",transition:"border-color .2s,box-shadow .2s" }} />
            </div>
            <button type="button" onClick={loadAthlete} disabled={loading}
              style={{ width:"100%",padding:"17px",borderRadius:"14px",border:"none",background:"linear-gradient(135deg,#34F3C6 0%,#21D0B3 50%,#15B09A 100%)",color:"#0d1b3e",fontSize:"16px",fontWeight:700,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1,letterSpacing:"0.03em",boxShadow:"0 4px 20px rgba(33,208,179,0.35)",transition:"opacity .2s,transform .1s" }}>
              {loading ? t("Cargando...") : t("Ver mi información")}
            </button>
            {error && <p style={{ color:"#fca5a5",fontSize:"13px",textAlign:"center",margin:0 }}>{error}</p>}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:"12px",margin:"24px 0" }}>
            <div style={{ flex:1,height:1,background:"rgba(255,255,255,0.08)" }} />
            <span style={{ fontSize:"11px",color:"rgba(255,255,255,0.25)",letterSpacing:"0.06em",whiteSpace:"nowrap" }}>{t("¿NO TIENES CÓDIGO?")}</span>
            <div style={{ flex:1,height:1,background:"rgba(255,255,255,0.08)" }} />
          </div>
          <div style={{ display:"grid",gap:"12px" }}>
            <div>
              <span style={{ fontSize:"11px",fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",display:"block",marginBottom:"8px" }}>{t("Correo electrónico")}</span>
              <input className="pu-input" type="email" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} onKeyDown={(e) => e.key==="Enter" && requestAccess()}
                placeholder="email@dominio.com"
                style={{ width:"100%",padding:"16px",borderRadius:"14px",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.9)",fontSize:"15px",outline:"none",fontWeight:500,boxSizing:"border-box",transition:"border-color .2s,box-shadow .2s" }} />
            </div>
            <button type="button" onClick={requestAccess} disabled={requestLoading}
              style={{ width:"100%",padding:"16px",borderRadius:"14px",border:"1px solid rgba(33,208,179,0.25)",background:"rgba(33,208,179,0.06)",color:"rgba(255,255,255,0.8)",fontSize:"15px",fontWeight:500,cursor:requestLoading?"not-allowed":"pointer",opacity:requestLoading?0.7:1,transition:"opacity .2s" }}>
              {requestLoading ? t("Enviando...") : t("Solicitar código")}
            </button>
            {requestStatus && <p style={{ color:"#6ee7b7",fontSize:"13px",margin:0 }}>{requestStatus}</p>}
            {requestError && <p style={{ color:"#fca5a5",fontSize:"13px",margin:0 }}>{requestError}</p>}
          </div>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════
     DASHBOARD
  ══════════════════════════════════════════════════════════ */
  const flightLabel = flight
    ? `${flight.airline} · ${flight.flightNumber}`
    : athlete.airline || athlete.flightNumber
    ? `${athlete.airline || "—"} · ${athlete.flightNumber || "—"}`
    : null;

  const hotelRoom_ = hotelRoom?.roomNumber || athlete.roomNumber;
  const hotelBed_ = hotelBed?.bedType || athlete.bedType;
  const luggage_ = luggageLabels[athlete.luggageType ?? ""] || athlete.luggageType;
  const vehicleLabel = vehicle ? `${vehicle.type} · ${vehicle.plate}` : null;
  const checkinsDone = checkins.filter(c => !!fmt(c.ts)).length;

  return (
    <div style={{ minHeight:"100vh", background:"#eef1f8", position:"relative", overflow:"hidden" }}>
      <style>{`
        @keyframes db-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes db-badge{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}
        @keyframes db-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes db-glow{0%,100%{opacity:0.4}50%{opacity:0.8}}
        @keyframes db-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        .db-card{
          animation:db-in .5s cubic-bezier(0.16,1,0.3,1) both;
          background:#fff;
          border:1px solid rgba(226,232,240,0.8);
          border-radius:24px;
          padding:24px;
          position:relative;
          overflow:hidden;
          box-shadow:0 2px 16px rgba(0,0,0,0.05);
          transition:box-shadow .3s,border-color .3s,transform .3s;
        }
        .db-card:nth-child(1){animation-delay:0.07s}
        .db-card:nth-child(2){animation-delay:0.14s}
        .db-card:nth-child(3){animation-delay:0.21s}
        .db-card:nth-child(4){animation-delay:0.28s}
        .db-card:hover{
          box-shadow:0 8px 32px rgba(33,208,179,0.14);
          border-color:rgba(33,208,179,0.28);
          transform:translateY(-2px);
        }
        .db-action-btn{
          transition:all .25s cubic-bezier(0.16,1,0.3,1);
          position:relative;
          overflow:hidden;
          width:100%;
        }
        .db-action-btn::after{
          content:'';
          position:absolute;
          inset:0;
          background:linear-gradient(rgba(255,255,255,0.15),transparent);
          opacity:0;
          transition:opacity .2s;
        }
        .db-action-btn:hover:not(:disabled)::after{opacity:1;}
        .db-action-btn:hover:not(:disabled){transform:translateY(-2px);}
        .db-action-btn:active:not(:disabled){transform:translateY(0);}
        .db-logout:hover{background:#f1f5f9!important;border-color:#cbd5e1!important;color:#334155!important;}
        .db-banner-glow{animation:db-glow 3s ease-in-out infinite;}

        /* ── Responsive ── */
        .db-banner-inner{padding:14px 20px;display:flex;align-items:center;justify-content:space-between;max-width:960px;margin:0 auto;position:relative;z-index:1;}
        .db-banner-logo{height:52px;width:auto;object-fit:contain;filter:drop-shadow(0 0 18px rgba(33,208,179,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.8));}
        .db-banner-tag{display:flex;align-items:center;gap:8px;}
        .db-banner-tag span{font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(33,208,179,0.9);}
        .db-content{max-width:920px;margin:0 auto;padding:24px 16px 72px;position:relative;z-index:1;}
        .db-profile-card{background:#fff;border-radius:24px;border:1px solid rgba(226,232,240,0.8);padding:24px 28px;margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;animation:db-in .4s cubic-bezier(0.16,1,0.3,1) both;box-shadow:0 4px 24px rgba(0,0,0,0.06);position:relative;overflow:hidden;}
        .db-profile-body{display:flex;align-items:center;gap:20px;min-width:0;}
        .db-avatar{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#21D0B3 0%,#062240 100%);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff;box-shadow:0 6px 24px rgba(33,208,179,0.4);letter-spacing:-0.02em;flex-shrink:0;}
        .db-profile-name{font-size:clamp(18px,2.5vw,26px);font-weight:800;color:#0f172a;margin:0 0 10px;letter-spacing:-0.02em;line-height:1.15;word-break:break-word;}
        .db-cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:20px;}
        .db-actions-card{background:#fff;border-radius:24px;border:1px solid rgba(226,232,240,0.8);padding:24px 28px;margin-bottom:16px;box-shadow:0 4px 20px rgba(0,0,0,0.05);animation:db-in .5s cubic-bezier(0.16,1,0.3,1) both;animation-delay:.32s;position:relative;overflow:hidden;}
        .db-actions-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;}
        .db-logout-label{display:inline;}

        @media(max-width:640px){
          .db-banner-inner{padding:8px 14px;}
          .db-banner-logo{height:30px!important;}
          .db-banner-tag span{font-size:8px;letter-spacing:0.1em;}
          .db-content{padding:10px 10px 40px;}
          .db-profile-card{padding:14px 14px 10px;gap:0;flex-direction:column;align-items:stretch;border-radius:18px;margin-bottom:10px;}
          .db-profile-body{gap:12px;margin-bottom:10px;}
          .db-avatar{width:42px!important;height:42px!important;font-size:14px!important;box-shadow:0 3px 12px rgba(33,208,179,0.3)!important;}
          .db-profile-name{font-size:17px!important;margin-bottom:5px!important;}
          .db-profile-btns{display:flex!important;gap:6px;width:100%;}
          .db-profile-btns .db-logout-btn{flex:1;justify-content:center;padding:8px 10px!important;font-size:11px!important;border-radius:10px!important;}
          .db-logout-label{display:inline!important;}
          .db-cards-grid{grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}
          .db-card{padding:12px;border-radius:14px;box-shadow:0 1px 8px rgba(0,0,0,0.04);}
          .db-card .db-card-icon{width:28px!important;height:28px!important;border-radius:8px!important;}
          .db-card .db-card-header{margin-bottom:8px!important;gap:8px!important;}
          .db-card .db-card-title{font-size:14px!important;}
          .db-card .db-card-subtitle{font-size:11px!important;}
          .db-actions-card{padding:12px;border-radius:14px;margin-bottom:10px;}
          .db-actions-grid{grid-template-columns:1fr;gap:8px;}
          .db-action-btn{padding:13px 14px!important;border-radius:12px!important;font-size:13px!important;min-height:44px!important;}
        }

        @media(max-width:400px){
          .db-banner-tag{display:none;}
          .db-cards-grid{grid-template-columns:1fr 1fr;gap:8px;}
        }
      `}</style>

      {/* Decorative background shapes */}
      <div style={{ position:"fixed",top:"-120px",right:"-120px",width:"500px",height:"500px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.07) 0%,transparent 65%)",pointerEvents:"none",zIndex:0 }} />
      <div style={{ position:"fixed",bottom:"-80px",left:"-80px",width:"380px",height:"380px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(31,205,255,0.06) 0%,transparent 65%)",pointerEvents:"none",zIndex:0 }} />

      {/* ── Top banner ── */}
      <div style={{ position:"relative",background:"linear-gradient(135deg,#041a2e 0%,#062240 45%,#0a3356 80%,#041a2e 100%)",overflow:"hidden",zIndex:1 }}>
        {/* Banner grid lines */}
        <div style={{ position:"absolute",inset:0,backgroundImage:`linear-gradient(rgba(33,208,179,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.04) 1px,transparent 1px)`,backgroundSize:"48px 48px",pointerEvents:"none" }} />
        {/* Banner glow accent */}
        <div className="db-banner-glow" style={{ position:"absolute",bottom:"-1px",left:"0",right:"0",height:"2px",background:"linear-gradient(90deg,transparent,#21D0B3 30%,#34F3C6 50%,#21D0B3 70%,transparent)",pointerEvents:"none" }} />
        <div className="db-banner-inner">
          <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" className="db-banner-logo" />
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <NotificationBell
              notifications={notify.notifications}
              unreadCount={notify.unreadCount}
              onMarkAllRead={notify.markAllRead}
              onClear={notify.clear}
            />
            <button type="button" onClick={loadAthlete} disabled={loading}
              style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:10,border:"1px solid rgba(33,208,179,0.4)",background:"rgba(33,208,179,0.12)",cursor:"pointer",flexShrink:0,opacity:loading?0.5:1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
            </button>
            <button type="button" onClick={() => { setAthlete(null); setAthleteId(""); }}
              style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:10,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.08)",cursor:"pointer",flexShrink:0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="db-content">

        {/* ── Profile card ── */}
        <div className="db-profile-card">
          {/* Left accent bar */}
          <div style={{ position:"absolute",left:0,top:0,bottom:0,width:"4px",background:"linear-gradient(180deg,#21D0B3,#1FCDFF,#21D0B3)" }} />
          {/* Subtle corner glow */}
          <div style={{ position:"absolute",top:0,right:0,width:"200px",height:"200px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.05) 0%,transparent 65%)",transform:"translate(60px,-60px)",pointerEvents:"none" }} />
          <div className="db-profile-body">
            <div style={{ position:"relative",flexShrink:0 }}>
              <div className="db-avatar">{initials}</div>
              <div style={{ position:"absolute",bottom:2,right:2,width:12,height:12,borderRadius:"50%",background:"#21D0B3",border:"2px solid #fff",boxShadow:"0 0 8px rgba(33,208,179,0.8)" }} />
            </div>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#21D0B3",margin:"0 0 5px" }}>Perfil</p>
              <h1 className="db-profile-name">{athlete.fullName}</h1>
              <div style={{ display:"flex",flexWrap:"wrap",gap:"6px" }}>
                {event?.name && (
                  <span style={{ fontSize:"11px",fontWeight:700,padding:"4px 12px",borderRadius:"20px",background:"linear-gradient(135deg,rgba(33,208,179,0.12),rgba(33,208,179,0.06))",color:"#0a7a6b",border:"1px solid rgba(33,208,179,0.3)",animation:"db-badge .4s cubic-bezier(0.16,1,0.3,1) both",animationDelay:".2s",letterSpacing:"0.01em" }}>
                    {event.name}
                  </span>
                )}
                {delegation && (
                  <span style={{ fontSize:"11px",fontWeight:600,padding:"4px 12px",borderRadius:"20px",background:"#f1f5f9",color:"#334155",border:"1px solid #dde3ed",animation:"db-badge .4s cubic-bezier(0.16,1,0.3,1) both",animationDelay:".3s" }}>
                    {countryLabels[delegation.countryCode] || delegation.countryCode}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Info cards grid ── */}
        <div className="db-cards-grid">

          {/* Vuelo */}
          <div className="db-card">
            <div style={{ position:"absolute",top:0,right:0,width:"120px",height:"120px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.09) 0%,transparent 70%)",transform:"translate(30px,-30px)",pointerEvents:"none" }} />
            <div className="db-card-header" style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"18px" }}>
              <div className="db-card-icon" style={{ width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,rgba(33,208,179,0.18),rgba(33,208,179,0.06))",border:"1px solid rgba(33,208,179,0.25)",display:"flex",alignItems:"center",justifyContent:"center",color:"#21D0B3",flexShrink:0,boxShadow:"0 2px 8px rgba(33,208,179,0.15)" }}>
                <IcoPlane />
              </div>
              <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#21D0B3" }}>{t("Vuelo")}</span>
            </div>
            {flightLabel ? (
              <>
                <p className="db-card-title" style={{ fontSize:"17px",fontWeight:800,color:"#0f172a",margin:"0 0 8px",letterSpacing:"-0.01em" }}>{flightLabel}</p>
                {(athlete.arrivalTime || flight?.arrivalTime) && (
                  <p className="db-card-subtitle" style={{ fontSize:"12px",color:"#64748b",margin:"0 0 4px",display:"flex",alignItems:"center",gap:"5px" }}>
                    <span style={{ color:"#21D0B3",fontWeight:600 }}>Arribo</span> · {fmt(athlete.arrivalTime || flight?.arrivalTime)}
                  </p>
                )}
                {athlete.origin && <p className="db-card-subtitle" style={{ fontSize:"12px",color:"#64748b",margin:0 }}><span style={{ color:"#21D0B3",fontWeight:600 }}>Origen</span> · {athlete.origin}</p>}
              </>
            ) : (
              <p style={{ fontSize:"13px",color:"#94a3b8",margin:0,fontStyle:"italic" }}>Sin vuelo asignado</p>
            )}
          </div>

          {/* Hotel */}
          <div className="db-card">
            <div style={{ position:"absolute",top:0,right:0,width:"120px",height:"120px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(52,243,198,0.08) 0%,transparent 70%)",transform:"translate(30px,-30px)",pointerEvents:"none" }} />
            <div className="db-card-header" style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"18px" }}>
              <div className="db-card-icon" style={{ width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,rgba(52,243,198,0.18),rgba(52,243,198,0.06))",border:"1px solid rgba(52,243,198,0.25)",display:"flex",alignItems:"center",justifyContent:"center",color:"#0fa894",flexShrink:0,boxShadow:"0 2px 8px rgba(52,243,198,0.15)" }}>
                <IcoHotel />
              </div>
              <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#0fa894" }}>{t("Hotel")}</span>
            </div>
            {hotel?.name ? (
              <>
                <p className="db-card-title" style={{ fontSize:"17px",fontWeight:800,color:"#0f172a",margin:"0 0 8px",letterSpacing:"-0.01em" }}>{hotel.name}</p>
                <div style={{ display:"flex",flexWrap:"wrap",gap:"4px" }}>
                  {hotelRoom_ && <span style={{ fontSize:"10px",padding:"3px 8px",borderRadius:"6px",background:"#f0fdf8",color:"#0a7a6b",border:"1px solid rgba(33,208,179,0.2)",fontWeight:600 }}>Hab. {hotelRoom_}</span>}
                  {hotelBed_ && <span style={{ fontSize:"10px",padding:"3px 8px",borderRadius:"6px",background:"#f1f5f9",color:"#475569",border:"1px solid #e2e8f0",fontWeight:500 }}>Cama {hotelBed_}</span>}
                  {luggage_ && <span style={{ display:"inline-flex",alignItems:"center",gap:"3px",fontSize:"10px",padding:"3px 8px",borderRadius:"6px",background:"#f1f5f9",color:"#475569",border:"1px solid #e2e8f0",fontWeight:500 }}><IcoBag />{luggage_}</span>}
                </div>
              </>
            ) : (
              <p style={{ fontSize:"13px",color:"#94a3b8",margin:0,fontStyle:"italic" }}>Sin hotel asignado</p>
            )}
          </div>

          {/* Transporte */}
          <div className="db-card" onClick={async () => {
            if (!trip) return;
            // Refresh trip before opening modal to always show current status
            try {
              const fresh = await apiFetch<Trip>(`/trips/${trip.id}`);
              setTrip(fresh);
            } catch { /* keep stale if fetch fails */ }
            setShowTripModal(true);
          }} style={{ cursor: trip ? "pointer" : undefined }}>
            <div style={{ position:"absolute",top:0,right:0,width:"120px",height:"120px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(31,205,255,0.07) 0%,transparent 70%)",transform:"translate(30px,-30px)",pointerEvents:"none" }} />
            <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"18px" }}>
              <div style={{ width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,rgba(31,205,255,0.15),rgba(31,205,255,0.05))",border:"1px solid rgba(31,205,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",color:"#0ea5c8",flexShrink:0,boxShadow:"0 2px 8px rgba(31,205,255,0.12)" }}>
                <IcoCar />
              </div>
              <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#0ea5c8" }}>{t("Viajes")}</span>
            </div>
            {trip ? (() => {
              const tripStatusColors: Record<string, { bg: string; color: string; label: string }> = {
                REQUESTED:  { bg:"rgba(251,191,36,0.12)",  color:"#d97706", label:"Solicitado" },
                SCHEDULED:  { bg:"rgba(33,208,179,0.12)",  color:"#0f9e87", label:"Programado" },
                EN_ROUTE:   { bg:"rgba(59,130,246,0.12)",  color:"#2563eb", label:"En ruta" },
                PICKED_UP:  { bg:"rgba(139,92,246,0.12)",  color:"#7c3aed", label:"En curso" },
                DROPPED_OFF:{ bg:"rgba(33,208,179,0.12)",  color:"#0f9e87", label:"Llegado al destino" },
                COMPLETED:  { bg:"rgba(100,116,139,0.1)",  color:"#475569", label:"Completado" },
              };
              const statusInfo = trip.status ? (tripStatusColors[trip.status] ?? { bg:"rgba(100,116,139,0.1)", color:"#64748b", label: trip.status }) : null;
              const scheduledFmt = trip.scheduledAt ? fmt(trip.scheduledAt) : null;
              return (
                <>
                  {statusInfo && (
                    <span style={{ display:"inline-block",padding:"3px 10px",borderRadius:"20px",background:statusInfo.bg,color:statusInfo.color,fontSize:"11px",fontWeight:700,letterSpacing:"0.06em",marginBottom:"12px" }}>
                      {statusInfo.label}
                    </span>
                  )}
                  {(trip.origin || trip.destination) && (
                    <p style={{ fontSize:"13px",fontWeight:700,color:"#0f172a",margin:"0 0 10px",lineHeight:1.4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical" as any }}>
                      {trip.origin || "–"} <span style={{ color:"#0ea5c8",fontWeight:800 }}>→</span> {trip.destination || "–"}
                    </p>
                  )}
                  {scheduledFmt && (
                    <p style={{ fontSize:"12px",color:"#64748b",margin:"0 0 10px",display:"flex",alignItems:"center",gap:"5px" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {scheduledFmt}
                    </p>
                  )}
                  <div style={{ borderTop:"1px solid #f1f5f9",paddingTop:"10px",display:"flex",flexDirection:"column",gap:"5px" }}>
                    {driver?.fullName && (
                      <p style={{ fontSize:"13px",color:"#334155",margin:0,display:"flex",alignItems:"center",gap:"6px" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0ea5c8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span style={{ fontWeight:600 }}>{driver.fullName}</span>
                      </p>
                    )}
                    {vehicleLabel && (
                      <p style={{ fontSize:"12px",color:"#64748b",margin:0,display:"flex",alignItems:"center",gap:"6px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3v-6l2.5-5h11L19 11v6h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M5 11h14"/></svg>
                        {vehicleLabel.toUpperCase()}
                      </p>
                    )}
                    {driverEta && trip.status === "EN_ROUTE" && (
                      <p style={{ fontSize:"12px",fontWeight:700,color:"#0ea5c8",margin:0,display:"flex",alignItems:"center",gap:"6px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ~{driverEta.duration} · {driverEta.distance}
                      </p>
                    )}
                  </div>
                </>
              );
            })() : (
              <p style={{ fontSize:"14px",color:"#94a3b8",margin:0,fontStyle:"italic" }}>{t("Sin viaje asignado")}</p>
            )}
          </div>

          {/* Check-ins */}
          <div className="db-card">
            <div style={{ position:"absolute",top:0,right:0,width:"120px",height:"120px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.05) 0%,transparent 70%)",transform:"translate(30px,-30px)",pointerEvents:"none" }} />
            <div className="db-card-header" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px" }}>
              <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
                <div className="db-card-icon" style={{ width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#f8fafc,#f1f5f9)",border:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",color:"#64748b",flexShrink:0 }}>
                  <IcoCheck />
                </div>
                <span style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#475569" }}>{t("Check-ins")}</span>
              </div>
              <span style={{ fontSize:"12px",fontWeight:700,color:checkinsDone===checkins.length?"#21D0B3":"#94a3b8" }}>{checkinsDone}/{checkins.length}</span>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
              {checkins.map(({ label, ts }) => {
                const done = !!fmt(ts);
                return (
                  <div key={label} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",padding:"8px 10px",borderRadius:"10px",background:done?"linear-gradient(135deg,rgba(33,208,179,0.06),rgba(33,208,179,0.02))":"#f8fafc",border:`1px solid ${done?"rgba(33,208,179,0.2)":"#f1f5f9"}`,transition:"all .3s" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                      <div style={{ width:8,height:8,borderRadius:"50%",flexShrink:0,background:done?"#21D0B3":"#cbd5e1",boxShadow:done?"0 0 6px rgba(33,208,179,0.7)":"none",transition:"all .3s" }} />
                      <span style={{ fontSize:"12px",color:done?"#0f172a":"#94a3b8",fontWeight:done?600:400 }}>{label}</span>
                    </div>
                    {done
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : <span style={{ fontSize:"9px",color:"#cbd5e1",fontWeight:500 }}>Pendiente</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="db-actions-card">
          {/* Subtle glow in corner */}
          <div style={{ position:"absolute",bottom:0,right:0,width:"220px",height:"220px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(33,208,179,0.06) 0%,transparent 65%)",transform:"translate(60px,60px)",pointerEvents:"none" }} />
          <p style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#94a3b8",margin:"0 0 16px" }}>Acciones</p>
          <div className="db-actions-grid">
            {[
              {
                field:"airportCheckinAt" as const,
                label: t("Marcar embarque / llegada"),
                doneLabel: t("Embarque confirmado"),
                icon: <IcoPlane />,
                done: !!athlete.airportCheckinAt,
                gradient: "linear-gradient(135deg,#21D0B3 0%,#17a68e 100%)",
                glow: "0 6px 24px rgba(33,208,179,0.4)",
                doneGlow: "0 4px 16px rgba(33,208,179,0.2)",
              },
              {
                field:"hotelCheckinAt" as const,
                label: t("Marcar check-in hotel"),
                doneLabel: t("Check-in confirmado"),
                icon: <IcoHotel />,
                done: !!athlete.hotelCheckinAt,
                gradient: "linear-gradient(135deg,#34F3C6 0%,#21D0B3 100%)",
                glow: "0 6px 24px rgba(52,243,198,0.4)",
                doneGlow: "0 4px 16px rgba(52,243,198,0.2)",
              },
              {
                field:"hotelCheckoutAt" as const,
                label: t("Marcar check-out hotel"),
                doneLabel: t("Check-out confirmado"),
                icon: <IcoCheck />,
                done: !!athlete.hotelCheckoutAt,
                gradient: null,
                glow: null,
                doneGlow: null,
              },
            ].map(({ field, label, doneLabel, icon, done, gradient, glow, doneGlow }) => {
              const busy = markLoading === field;
              return (
                <button key={field} className="db-action-btn" type="button" onClick={() => mark(field)}
                  disabled={!!markLoading || done}
                  style={{
                    padding:"16px 20px",
                    borderRadius:"16px",
                    fontSize:"14px",
                    fontWeight:700,
                    cursor:(!!markLoading||done)?"not-allowed":"pointer",
                    border: done
                      ? "1px solid rgba(33,208,179,0.25)"
                      : gradient
                        ? "none"
                        : "1.5px solid #dde3ed",
                    background: done
                      ? "linear-gradient(135deg,rgba(33,208,179,0.08),rgba(33,208,179,0.03))"
                      : gradient ?? "#f8fafc",
                    color: done ? "#0a7a6b" : gradient ? "#062B22" : "#475569",
                    opacity: busy ? 0.7 : 1,
                    boxShadow: done ? doneGlow ?? "none" : glow ?? "0 2px 8px rgba(0,0,0,0.06)",
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center",
                    gap:"10px",
                    letterSpacing:"0.01em",
                  }}>
                  <span style={{ opacity: done ? 0.8 : 1, display:"flex", alignItems:"center" }}>
                    {done
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : icon
                    }
                  </span>
                  {busy ? "..." : done ? doneLabel : label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{ color:"#dc2626",fontSize:"13px",textAlign:"center",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:"14px",padding:"12px 20px",marginBottom:"16px" }}>{error}</div>
        )}

        {/* ── Trip detail modal ── */}
        {showTripModal && trip && (
          <div
            onClick={() => setShowTripModal(false)}
            style={{ position:"fixed",inset:0,background:"rgba(2,12,24,0.65)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(4px)" }}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background:"#fff",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:"680px",maxHeight:"90vh",overflowY:"auto",padding:"0 0 32px" }}>
              {/* Handle */}
              <div style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px" }}>
                <div style={{ width:40,height:4,borderRadius:4,background:"#e2e8f0" }} />
              </div>
              {/* Header */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 24px 16px" }}>
                <div>
                  <p style={{ fontSize:"10px",fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"#0ea5c8",margin:"0 0 4px" }}>Detalle del viaje</p>
                  {(trip.origin || trip.destination) && (
                    <h2 style={{ fontSize:"20px",fontWeight:800,color:"#0f172a",margin:0,letterSpacing:"-0.02em" }}>
                      {trip.origin || "–"} <span style={{ color:"#0ea5c8" }}>→</span> {trip.destination || "–"}
                    </h2>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowTripModal(false)}
                  style={{ width:36,height:36,borderRadius:"50%",border:"1px solid #e2e8f0",background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {/* Map */}
              <div style={{ margin:"0 0 20px" }}>
                <TripMap origin={trip.origin} destination={trip.destination} driverPosition={driverPos} userPosition={userPos} height={260} />
              </div>
              {/* Details */}
              <div style={{ padding:"0 24px",display:"flex",flexDirection:"column",gap:"12px" }}>
                {/* Status */}
                {(() => {
                  const tripStatusColors: Record<string, { bg: string; color: string; label: string }> = {
                    REQUESTED:  { bg:"rgba(251,191,36,0.12)",  color:"#d97706", label:"Solicitado" },
                    SCHEDULED:  { bg:"rgba(33,208,179,0.12)",  color:"#0f9e87", label:"Programado" },
                    EN_ROUTE:   { bg:"rgba(59,130,246,0.12)",  color:"#2563eb", label:"En ruta" },
                    PICKED_UP:  { bg:"rgba(139,92,246,0.12)",  color:"#7c3aed", label:"En curso" },
                    DROPPED_OFF:{ bg:"rgba(33,208,179,0.12)",  color:"#0f9e87", label:"Llegado al destino" },
                    COMPLETED:  { bg:"rgba(100,116,139,0.1)",  color:"#475569", label:"Completado" },
                  };
                  const s = trip.status ? (tripStatusColors[trip.status] ?? { bg:"rgba(100,116,139,0.1)", color:"#64748b", label: trip.status }) : null;
                  return s ? (
                    <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                      <span style={{ padding:"4px 14px",borderRadius:"20px",background:s.bg,color:s.color,fontSize:"12px",fontWeight:700,letterSpacing:"0.06em" }}>{s.label}</span>
                    </div>
                  ) : null;
                })()}
                {/* Scheduled */}
                {trip.scheduledAt && fmt(trip.scheduledAt) && (
                  <div style={{ display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:"#475569" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5c8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span><strong style={{ color:"#0f172a" }}>Hora programada:</strong> {fmt(trip.scheduledAt)}</span>
                  </div>
                )}
                {/* ETA */}
                {driverEta && trip.status === "EN_ROUTE" && (
                  <div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"10px 16px",borderRadius:"12px",background:"rgba(14,165,200,0.08)",border:"1px solid rgba(14,165,200,0.2)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0ea5c8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span style={{ fontSize:"14px",fontWeight:700,color:"#0ea5c8" }}>~{driverEta.duration}</span>
                    <span style={{ fontSize:"13px",color:"#475569" }}>· {driverEta.distance}</span>
                  </div>
                )}
                {/* Driver */}
                {driver?.fullName && (
                  <div style={{ display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:"#475569" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5c8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span><strong style={{ color:"#0f172a" }}>Conductor:</strong> {driver.fullName}</span>
                  </div>
                )}
                {/* Vehicle */}
                {vehicleLabel && (
                  <div style={{ display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:"#475569" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3v-6l2.5-5h11L19 11v6h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M5 11h14"/></svg>
                    <span><strong style={{ color:"#0f172a" }}>Vehículo:</strong> {vehicleLabel.toUpperCase()}</span>
                  </div>
                )}
                {/* Notes */}
                {trip.notes && (
                  <div style={{ padding:"12px 16px",borderRadius:"12px",background:"#f8fafc",border:"1px solid #e2e8f0",fontSize:"13px",color:"#475569" }}>
                    <strong style={{ color:"#0f172a" }}>Notas:</strong> {trip.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Rating popup ── */}
        {showRating && trip && (
          <div
            onClick={() => { setShowRating(false); setRatingStars(0); setRatingComment(""); }}
            style={{ position:"fixed",inset:0,background:"rgba(2,12,24,0.7)",zIndex:150,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)",padding:16 }}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background:"#fff",borderRadius:24,width:"100%",maxWidth:380,padding:"32px 24px",textAlign:"center",animation:"db-in .4s cubic-bezier(0.16,1,0.3,1) both",position:"relative" }}>
              {/* Close button */}
              <button type="button" onClick={() => { setShowRating(false); setRatingStars(0); setRatingComment(""); }}
                style={{ position:"absolute",top:12,right:12,width:36,height:36,borderRadius:"50%",border:"none",background:"#f1f5f9",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              {/* Emoji */}
              <div style={{ fontSize:48,marginBottom:12 }}>
                {ratingStars === 0 ? "🚗" : ratingStars <= 2 ? "😕" : ratingStars <= 3 ? "🙂" : ratingStars <= 4 ? "😊" : "🤩"}
              </div>
              <h3 style={{ fontSize:20,fontWeight:800,color:"#0f172a",margin:"0 0 4px" }}>¿Cómo fue tu viaje?</h3>
              <p style={{ fontSize:13,color:"#64748b",margin:"0 0 20px" }}>Evalúa a tu conductor</p>
              {/* Stars */}
              <div style={{ display:"flex",justifyContent:"center",gap:8,marginBottom:20 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => setRatingStars(star)}
                    style={{ background:"none",border:"none",cursor:"pointer",padding:4,transition:"transform .15s",transform: ratingStars >= star ? "scale(1.15)" : "scale(1)" }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill={ratingStars >= star ? "#FBBF24" : "none"} stroke={ratingStars >= star ? "#F59E0B" : "#CBD5E1"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </button>
                ))}
              </div>
              {/* Comment */}
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Comentario opcional..."
                rows={2}
                style={{ width:"100%",padding:12,borderRadius:12,border:"1px solid #e2e8f0",fontSize:14,resize:"none",outline:"none",boxSizing:"border-box",marginBottom:16,fontFamily:"inherit" }}
              />
              {/* Submit */}
              <button type="button" onClick={submitRating} disabled={ratingStars === 0 || ratingLoading}
                style={{ width:"100%",padding:16,borderRadius:14,border:"none",background: ratingStars > 0 ? "linear-gradient(135deg,#34F3C6,#21D0B3)" : "#e2e8f0",color: ratingStars > 0 ? "#0d1b3e" : "#94a3b8",fontSize:16,fontWeight:700,cursor: ratingStars > 0 ? "pointer" : "not-allowed",opacity: ratingLoading ? 0.7 : 1 }}>
                {ratingLoading ? "Enviando..." : "Enviar evaluación"}
              </button>
              <button type="button" onClick={() => { setShowRating(false); setRatingStars(0); setRatingComment(""); }}
                style={{ marginTop:8,background:"none",border:"none",color:"#94a3b8",fontSize:13,cursor:"pointer",padding:8 }}>
                Omitir
              </button>
            </div>
          </div>
        )}

        {/* ── Trip Chat (active trips only) ── */}
        {trip && ["SCHEDULED", "EN_ROUTE", "PICKED_UP"].includes(trip.status ?? "") && (
          <TripChat
            tripId={trip.id}
            senderType="PASSENGER"
            senderName={athlete.fullName}
            onNewMessage={(name, content) => notify.push(`${name}: ${content.slice(0, 80)}`, "💬")}
          />
        )}

        {/* ── Footer ── */}
        <div style={{ textAlign:"center",marginTop:"48px",display:"flex",flexDirection:"column",alignItems:"center",gap:"8px" }}>
          <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena"
            style={{ height:"40px",width:"auto",objectFit:"contain",opacity:0.85 }} />
          <p style={{ fontSize:"10px",color:"#94a3b8",letterSpacing:"0.1em",textTransform:"uppercase",margin:0 }}>Portal de Participantes</p>
        </div>
      </div>
    </div>
  );
}
