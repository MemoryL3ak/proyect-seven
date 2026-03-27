"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";

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

type Flight = {
  id: string;
  flightNumber: string;
  airline: string;
  arrivalTime: string | null;
};

type Hotel = {
  id: string;
  name: string;
};

type HotelAssignment = {
  id: string;
  participantId?: string;
  participant_id?: string;
  hotelId?: string;
  hotel_id?: string;
  roomId?: string | null;
  room_id?: string | null;
  bedId?: string | null;
  bed_id?: string | null;
  checkinAt?: string | null;
  checkin_at?: string | null;
  checkoutAt?: string | null;
  checkout_at?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

type HotelRoom = {
  id: string;
  roomNumber: string;
  roomType: string;
};

type HotelBed = {
  id: string;
  bedType: string;
};

type Vehicle = {
  id: string;
  plate: string;
  type: string;
};

type Trip = {
  id: string;
  driverId: string;
  vehicleId?: string | null;
  athleteIds?: string[];
  clientType?: string | null;
};

type Driver = {
  id: string;
  fullName: string;
  userId?: string | null;
};

type Event = {
  id: string;
  name: string;
};

type Delegation = {
  id: string;
  countryCode: string;
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

const luggageLabels: Record<string, string> = {
  BAG: "Bolso",
  SUITCASE_8: "Maleta 8",
  SUITCASE_15: "Maleta 15",
  SUITCASE_23: "Maleta 23",
  EXTRA_BAGGAGE: "Sobreequipaje"
};

const formatDate = (value?: string | null) =>
  value &&
  value !== "null" &&
  value !== "undefined" &&
  !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleString()
    : "-";

const normalizeHotelAssignment = (item: HotelAssignment) => ({
  id: item.id,
  participantId: item.participantId ?? item.participant_id ?? "",
  hotelId: item.hotelId ?? item.hotel_id ?? "",
  roomId: item.roomId ?? item.room_id ?? null,
  bedId: item.bedId ?? item.bed_id ?? null,
  checkinAt:
    item.checkinAt === "null" || item.checkin_at === "null"
      ? null
      : (item.checkinAt ?? item.checkin_at ?? null),
  checkoutAt:
    item.checkoutAt === "null" || item.checkout_at === "null"
      ? null
      : (item.checkoutAt ?? item.checkout_at ?? null),
  createdAt: item.createdAt ?? item.created_at ?? "",
  updatedAt: item.updatedAt ?? item.updated_at ?? ""
});

export default function AthletePortalPage() {
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

  const loadAthlete = async () => {
    if (!athleteId) return;
    setLoading(true);
    setError(null);
    try {
      const normalizedInput = athleteId.trim();
      if (normalizedInput.length < 6) {
        setError(t("El código ingresado no es válido."));
        return;
      }
      const list = await apiFetch<Athlete[]>(`/athletes`);
      const validatedAthletes = filterValidatedAthletes(list || []);
      const match = validatedAthletes.find((athlete) => athlete.id?.slice(-6) === normalizedInput);
      if (!match) {
        setError(t("El código ingresado no corresponde a un usuario registrado."));
        return;
      }
      const data = await apiFetch<Athlete>(`/athletes/${match.id}`);
      setAthlete(data);

      const [
        flightData,
        hotelData,
        vehicleData,
        tripData,
        tripsList,
        eventData,
        delegationData,
        assignmentData
      ] =
        await Promise.all([
          data.arrivalFlightId
            ? apiFetch<Flight>(`/flights/${data.arrivalFlightId}`)
            : Promise.resolve(null),
          data.hotelAccommodationId
            ? apiFetch<Hotel>(`/accommodations/${data.hotelAccommodationId}`)
            : Promise.resolve(null),
          data.transportVehicleId
            ? apiFetch<Vehicle>(`/transports/${data.transportVehicleId}`)
            : Promise.resolve(null),
          data.transportTripId
            ? apiFetch<Trip>(`/trips/${data.transportTripId}`)
            : Promise.resolve(null),
          data.transportTripId ? Promise.resolve([]) : apiFetch<Trip[]>(`/trips`),
          data.eventId ? apiFetch<Event>(`/events/${data.eventId}`) : Promise.resolve(null),
          data.delegationId
            ? apiFetch<Delegation>(`/delegations/${data.delegationId}`)
            : Promise.resolve(null),
          apiFetch<HotelAssignment | null>(
            `/hotel-assignments/by-participant/${data.id}`
          )
        ]);
      const assignment = assignmentData
        ? normalizeHotelAssignment(assignmentData)
        : null;

      setFlight(flightData);
      setHotelAssignment(assignment);
      setEvent(eventData);
      setDelegation(delegationData);

      let resolvedHotel = hotelData;
      if (assignment?.hotelId && (!resolvedHotel || resolvedHotel.id !== assignment.hotelId)) {
        try {
          resolvedHotel = await apiFetch<Hotel>(`/accommodations/${assignment.hotelId}`);
        } catch {
          resolvedHotel = resolvedHotel ?? null;
        }
      }
      setHotel(resolvedHotel);

      const inferredTrip =
        tripData ??
        (tripsList || []).find((trip) =>
          (trip.athleteIds || []).includes(data.id)
        ) ??
        null;

      setTrip(inferredTrip);

      let resolvedVehicle = vehicleData;
      if (inferredTrip?.vehicleId && !vehicleData) {
        try {
          resolvedVehicle = await apiFetch<Vehicle>(
            `/transports/${inferredTrip.vehicleId}`
          );
        } catch {
          resolvedVehicle = null;
        }
      }
      setVehicle(resolvedVehicle);

      let resolvedDriver: Driver | null = null;
      if (inferredTrip?.driverId) {
        try {
          const drivers = await apiFetch<Driver[]>(`/drivers`);
          resolvedDriver =
            (drivers || []).find(
              (driver) =>
                driver.id === inferredTrip.driverId ||
                driver.userId === inferredTrip.driverId
            ) ?? null;
        } catch {
          resolvedDriver = null;
        }
      }
      setDriver(resolvedDriver);

      if (assignment?.roomId) {
        try {
          const room = await apiFetch<HotelRoom>(`/hotel-rooms/${assignment.roomId}`);
          setHotelRoom(room);
        } catch {
          setHotelRoom(null);
        }
      } else {
        setHotelRoom(null);
      }

      if (assignment?.bedId) {
        try {
          const bed = await apiFetch<HotelBed>(`/hotel-beds/${assignment.bedId}`);
          setHotelBed(bed);
        } catch {
          setHotelBed(null);
        }
      } else {
        setHotelBed(null);
      }
    } catch (err) {
      let message = err instanceof Error ? err.message : "";
      try {
        const parsed = JSON.parse(message);
        if (parsed?.message) {
          message = parsed.message;
        }
      } catch {
        // keep message
      }
      setError(message || t("No se pudo cargar"));
      setFlight(null);
      setHotel(null);
      setVehicle(null);
      setDriver(null);
      setTrip(null);
      setEvent(null);
      setDelegation(null);
      setHotelAssignment(null);
      setHotelRoom(null);
      setHotelBed(null);
    } finally {
      setLoading(false);
    }
  };

  const mark = async (
    field: "airportCheckinAt" | "hotelCheckinAt" | "hotelCheckoutAt"
  ) => {
    if (!athlete) return;
    setLoading(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const payload = { [field]: now };
      const updated = await apiFetch<Athlete>(`/athletes/${athlete.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setAthlete(updated);

      if (hotelAssignment?.id && (field === "hotelCheckinAt" || field === "hotelCheckoutAt")) {
        const assignmentPayload =
          field === "hotelCheckinAt"
            ? { checkinAt: now }
            : { checkoutAt: now };

        try {
          await apiFetch(`/hotel-assignments/${hotelAssignment.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(assignmentPayload)
          });
        } catch {
          // keep athlete update even if hotel-assignment sync fails
        }

        setHotelAssignment((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            ...(field === "hotelCheckinAt" ? { checkinAt: now } : {}),
            ...(field === "hotelCheckoutAt" ? { checkoutAt: now } : {})
          };
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo actualizar"));
    } finally {
      setLoading(false);
    }
  };

  const requestAccess = async () => {
    if (!requestEmail) return;
    setRequestLoading(true);
    setRequestError(null);
    setRequestStatus(null);
    try {
      const response = await apiFetch<{ message?: string }>(`/athletes/request-access`, {
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
      if (message.includes("encargado de delegación")) {
        message = t("El correo ingresado no está autorizado para solicitar el código.");
      }
      setRequestError(message || t("No se pudo actualizar"));
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <>
      {!athlete && (
        <div className="flex flex-col lg:flex-row" style={{ minHeight: "100vh", background: "#020c18", position: "relative", overflow: "hidden" }}>
          <style>{`
            @keyframes pu-f1{0%,100%{transform:translateY(0px) scale(1)}50%{transform:translateY(-30px) translateX(10px) scale(1.05)}}
            @keyframes pu-f2{0%,100%{transform:translateY(0px)}50%{transform:translateY(-20px) translateX(15px)}}
            @keyframes pu-pulse{0%,100%{opacity:0.15;transform:scale(1)}50%{opacity:0.4;transform:scale(1.08)}}
            @keyframes pu-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
            @keyframes pu-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
            .pu-form{animation:pu-in 0.6s cubic-bezier(0.16,1,0.3,1) both;animation-delay:0.15s;opacity:0;}
          `}</style>

          {/* Left branding panel */}
          <div className="flex flex-col justify-between p-8 lg:p-14 lg:w-[46%] lg:flex-shrink-0"
            style={{ background: "linear-gradient(160deg,#020c18 0%,#041a2e 40%,#062240 70%,#030f1e 100%)", position: "relative", overflow: "hidden", minHeight: "180px" }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: `linear-gradient(rgba(33,208,179,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.03) 1px,transparent 1px)`, backgroundSize: "60px 60px" }} />
            <div style={{ position: "absolute", top: "-60px", left: "-60px", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(6,34,64,0.6) 0%,transparent 70%)", animation: "pu-f1 12s ease-in-out infinite", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "60px", right: "-40px", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(33,208,179,0.1) 0%,transparent 70%)", animation: "pu-f2 16s ease-in-out infinite", pointerEvents: "none" }} />
            {[480, 340, 200].map((size, i) => (
              <div key={i} style={{ position: "absolute", top: "50%", left: "50%", marginTop: -size / 2, marginLeft: -size / 2, width: size, height: size, borderRadius: "50%", border: `1px solid rgba(33,208,179,${0.04 + i * 0.04})`, animation: `pu-pulse 6s ease-in-out infinite ${i * 2}s`, pointerEvents: "none" }} />
            ))}
            <div style={{ position: "relative", zIndex: 1 }}>
              <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" className="h-14 sm:h-20 lg:h-28" style={{ width: "auto", objectFit: "contain", filter: "drop-shadow(0 0 30px rgba(33,208,179,0.4)) drop-shadow(0 4px 12px rgba(0,0,0,0.9))" }} />
            </div>
            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "16px", padding: "24px 0" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#21D0B3", boxShadow: "0 0 10px #21D0B3", display: "inline-block", animation: "pu-pulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#21D0B3" }}>Portal de Participantes</span>
              </div>
              <h1 style={{ fontSize: "clamp(28px,3vw,44px)", fontWeight: 800, lineHeight: 1.1, color: "#f8fafc", letterSpacing: "-0.02em", margin: 0 }}>
                Tu itinerario<br />
                <span style={{ background: "linear-gradient(90deg,#21D0B3 0%,#34F3C6 40%,#21D0B3 80%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "pu-shimmer 4s linear infinite" }}>en tiempo real</span>
              </h1>
              <p className="hidden sm:block" style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", maxWidth: "340px", lineHeight: 1.7, margin: 0 }}>
                Accede a tu vuelo, hotel y transporte asignado. Confirma cada etapa de tu llegada al evento.
              </p>
              <div className="hidden lg:flex flex-col" style={{ gap: "10px", marginTop: "8px" }}>
                {([
                  [<svg key="plane" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(33,208,179,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 1 16.5 2.5L13 6 4.8 4.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 5.2 5.3c.4.4.9.4 1.3.3l.5-.3c.4-.3.6-.7.5-1.1z"/></svg>, "Información de vuelo"],
                  [<svg key="hotel" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(33,208,179,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-8 0v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>, "Hotel y habitación"],
                  [<svg key="bus" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(33,208,179,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>, "Transporte asignado"],
                ] as [React.ReactNode, string][]).map(([icon, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden lg:flex" style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "20px" }}>
              {[["Acceso seguro", "SSL / HTTPS"], ["Datos live", "Tiempo real"], ["Multi-evento", "Global"]].map(([title, sub], i, arr) => (
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
            <div className="pu-form relative z-10 w-full" style={{ maxWidth: "420px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "rgba(255,255,255,0.95)", marginBottom: "6px" }}>{t("Acceder al portal")}</h2>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "28px", lineHeight: 1.6 }}>
                {t("Ingresa tu código de participante para ver tu información asignada.")}
              </p>
              <div style={{ display: "grid", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: "8px" }}>{t("Código de acceso")}</span>
                  <input
                    value={athleteId}
                    onChange={(e) => setAthleteId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadAthlete()}
                    placeholder={t("Ingresa tu código")}
                    style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "1px solid rgba(33,208,179,0.2)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.9)", fontSize: "15px", outline: "none", fontWeight: 500, boxSizing: "border-box" }}
                  />
                </div>
                <button type="button" onClick={loadAthlete} disabled={loading}
                  style={{ width: "100%", padding: "17px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg,#34F3C6 0%,#21D0B3 50%,#15B09A 100%)", color: "#0d1b3e", fontSize: "16px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, letterSpacing: "0.03em", boxShadow: "0 4px 20px rgba(33,208,179,0.35)" }}>
                  {loading ? t("Cargando...") : t("Ver mi información")}
                </button>
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

      {athlete && (
        <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ background: "var(--elevated)" }}>
          <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-[30px] p-6 shadow-sm space-y-5" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>{t("Perfil")}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>{athlete.fullName}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full px-3 py-1 font-medium" style={{ background: "var(--elevated)", color: "var(--text)" }}>
                    {t("Evento")}: {event?.name || "-"}
                  </span>
                  <span className="rounded-full px-3 py-1 font-medium" style={{ background: "var(--elevated)", color: "var(--text)" }}>
                    {t("Delegación")}: {delegation ? countryLabels[delegation.countryCode] || delegation.countryCode : "-"}
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost h-11 px-5" type="button" onClick={() => { setAthlete(null); setAthleteId(""); }}>
                {t("Cerrar sesión")}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl px-4 py-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>{t("Vuelo")}</div>
                <p className="mt-2 text-sm font-medium" style={{ color: "var(--text)" }}>
                  {flight
                    ? `${flight.airline} · ${flight.flightNumber}`
                    : athlete.airline || athlete.flightNumber
                    ? `${athlete.airline || t("Aerolínea")} · ${athlete.flightNumber || "-"}`
                    : "-"}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  {t("Arribo")}: {formatDate(athlete.arrivalTime || flight?.arrivalTime)}
                </p>
              </div>
              <div className="rounded-2xl px-4 py-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>{t("Hotel")}</div>
                <p className="mt-2 text-sm font-medium" style={{ color: "var(--text)" }}>{hotel?.name || "-"}</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  {t("Habitación")}: {hotelRoom?.roomNumber || athlete.roomNumber || "-"} · {t("Cama")}: {hotelBed?.bedType || athlete.bedType || "-"}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {t("Equipaje")}: {luggageLabels[athlete.luggageType ?? ""] || athlete.luggageType || "-"}
                </p>
              </div>
              <div className="rounded-2xl px-4 py-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>{t("Transporte")}</div>
                <p className="mt-2 text-sm font-medium" style={{ color: "var(--text)" }}>{t("Conductor")}: {driver?.fullName || "-"}</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  {t("Vehículo")}: {vehicle ? `${vehicle.type} · ${vehicle.plate}` : "-"}
                </p>
              </div>
              <div className="rounded-2xl px-4 py-4" style={{ border: "1px solid var(--border)", background: "var(--elevated)" }}>
                <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>{t("Check-ins")}</div>
                <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{t("Aeropuerto")}: {formatDate(athlete.airportCheckinAt)}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("Hotel")}: {formatDate(athlete.hotelCheckinAt)}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("Check-out")}: {formatDate(athlete.hotelCheckoutAt)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary" onClick={() => mark("airportCheckinAt")}>
                {t("Marcar embarque / llegada")}
              </button>
              <button className="btn btn-primary" onClick={() => mark("hotelCheckinAt")}>
                {t("Marcar check-in hotel")}
              </button>
              <button className="btn btn-ghost" onClick={() => mark("hotelCheckoutAt")}>
                {t("Marcar check-out hotel")}
              </button>
            </div>
          </section>
          </div>
        </div>
      )}
    </>
  );
}


