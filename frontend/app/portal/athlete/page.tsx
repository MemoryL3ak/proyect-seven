"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
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

type Vehicle = {
  id: string;
  plate: string;
  type: string;
};

type Trip = {
  id: string;
  driverId: string;
};

type Driver = {
  id: string;
  fullName: string;
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

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

export default function AthletePortalPage() {
  const { t } = useI18n();
  const [athleteId, setAthleteId] = useState("");
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAthlete = async () => {
    if (!athleteId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Athlete>(`/athletes/${athleteId}`);
      setAthlete(data);

      const [flightData, hotelData, vehicleData, tripData, eventData, delegationData] = await Promise.all([
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
        data.eventId ? apiFetch<Event>(`/events/${data.eventId}`) : Promise.resolve(null),
        data.delegationId
          ? apiFetch<Delegation>(`/delegations/${data.delegationId}`)
          : Promise.resolve(null)
      ]);

      setFlight(flightData);
      setHotel(hotelData);
      setVehicle(vehicleData);
      setEvent(eventData);
      setDelegation(delegationData);

      if (tripData?.driverId) {
        const driverData = await apiFetch<Driver>(`/drivers/${tripData.driverId}`);
        setDriver(driverData);
      } else {
        setDriver(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cargar"));
      setFlight(null);
      setHotel(null);
      setVehicle(null);
      setDriver(null);
      setEvent(null);
      setDelegation(null);
    } finally {
      setLoading(false);
    }
  };

  const mark = async (field: "airportCheckinAt" | "hotelCheckinAt" | "hotelCheckoutAt") => {
    if (!athlete) return;
    setLoading(true);
    setError(null);
    try {
      const payload = { [field]: new Date().toISOString() };
      const updated = await apiFetch<Athlete>(`/athletes/${athlete.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setAthlete(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo actualizar"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!athlete && (
        <div className="flex flex-col lg:flex-row" style={{ minHeight: "100vh", background: "#020b1a", position: "relative", overflow: "hidden" }}>
          <style>{`
            @keyframes pa-f1{0%,100%{transform:translateY(0px) scale(1)}50%{transform:translateY(-30px) translateX(10px) scale(1.05)}}
            @keyframes pa-f2{0%,100%{transform:translateY(0px)}50%{transform:translateY(-20px) translateX(15px)}}
            @keyframes pa-pulse{0%,100%{opacity:0.15;transform:scale(1)}50%{opacity:0.4;transform:scale(1.08)}}
            @keyframes pa-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
            @keyframes pa-particle{0%{transform:translateY(100vh);opacity:0}10%{opacity:0.6}90%{opacity:0.6}100%{transform:translateY(-100px) translateX(40px);opacity:0}}
            @keyframes pa-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
            .pa-dot{position:absolute;width:2px;height:2px;border-radius:50%;background:rgba(201,168,76,0.6);animation:pa-particle linear infinite;pointer-events:none;}
            .pa-form{animation:pa-in 0.6s cubic-bezier(0.16,1,0.3,1) both;animation-delay:0.15s;opacity:0;}
          `}</style>

          {/* Left branding panel */}
          <div className="flex flex-col justify-between p-8 lg:p-14 lg:w-[46%] lg:flex-shrink-0"
            style={{ background: "linear-gradient(160deg,#020b1a 0%,#071530 40%,#0d2255 70%,#07101f 100%)", position: "relative", overflow: "hidden", minHeight: "280px" }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: `linear-gradient(rgba(201,168,76,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.03) 1px,transparent 1px)`, backgroundSize: "60px 60px" }} />
            <div style={{ position: "absolute", top: "-60px", left: "-60px", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(30,58,138,0.5) 0%,transparent 70%)", animation: "pa-f1 12s ease-in-out infinite", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "60px", right: "-40px", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(201,168,76,0.18) 0%,transparent 70%)", animation: "pa-f2 16s ease-in-out infinite", pointerEvents: "none" }} />
            {[480, 340, 200].map((size, i) => (
              <div key={i} style={{ position: "absolute", top: "50%", left: "50%", marginTop: -size / 2, marginLeft: -size / 2, width: size, height: size, borderRadius: "50%", border: `1px solid rgba(201,168,76,${0.04 + i * 0.04})`, animation: `pa-pulse 6s ease-in-out infinite ${i * 2}s`, pointerEvents: "none" }} />
            ))}
            {["10%", "28%", "48%", "68%", "85%"].map((left, i) => (
              <div key={i} className="pa-dot" style={{ left, bottom: "-10px", animationDelay: `${i * 1.8}s`, animationDuration: `${9 + i * 1.5}s` }} />
            ))}
            <div style={{ position: "relative", zIndex: 1 }}>
              <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" style={{ height: 110, width: "auto", objectFit: "contain", filter: "drop-shadow(0 0 30px rgba(201,168,76,0.5)) drop-shadow(0 4px 12px rgba(0,0,0,0.9))" }} />
            </div>
            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "16px", padding: "24px 0" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22d3ee", boxShadow: "0 0 10px #22d3ee", display: "inline-block", animation: "pa-pulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#22d3ee" }}>Portal de Atletas</span>
              </div>
              <h1 style={{ fontSize: "clamp(28px,3vw,44px)", fontWeight: 800, lineHeight: 1.1, color: "#f8fafc", letterSpacing: "-0.02em", margin: 0 }}>
                Tu itinerario<br />
                <span style={{ background: "linear-gradient(90deg,#c9a84c 0%,#f0d070 40%,#c9a84c 80%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "pa-shimmer 4s linear infinite" }}>completo</span>
              </h1>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", maxWidth: "340px", lineHeight: 1.7, margin: 0 }}>
                Consulta tu vuelo, hotel y transporte asignado para el evento. Registra tu llegada y check-ins.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                {[["✈️", "Vuelo y hora de arribo"], ["🏨", "Hotel y habitación asignada"], ["📋", "Check-ins y confirmaciones"]].map(([icon, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "16px" }}>{icon}</span>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "20px", display: "flex" }}>
              {[["Acceso seguro", "SSL / HTTPS"], ["Datos live", "Tiempo real"], ["Multi-evento", "Global"]].map(([title, sub], i, arr) => (
                <div key={title} style={{ flex: 1, paddingRight: i < arr.length - 1 ? "20px" : "0", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", paddingLeft: i > 0 ? "20px" : "0" }}>
                  <p style={{ fontSize: "14px", fontWeight: 800, color: "#c9a84c", margin: 0, lineHeight: 1 }}>{title}</p>
                  <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)", margin: "3px 0 0", letterSpacing: "0.05em", textTransform: "uppercase" }}>{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right form panel */}
          <div className="flex-1 flex items-center justify-center p-8 lg:p-16"
            style={{ background: "linear-gradient(160deg,#03111f 0%,#071530 50%,#050f20 100%)", position: "relative", overflow: "hidden", minHeight: "100vh" }}>
            <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(20,50,120,0.3) 0%,transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "-50px", right: "-50px", width: "280px", height: "280px", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(201,168,76,0.1) 0%,transparent 70%)", pointerEvents: "none" }} />
            <div className="pa-form relative z-10 w-full" style={{ maxWidth: "420px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "rgba(255,255,255,0.95)", marginBottom: "6px" }}>{t("Acceder al portal")}</h2>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "28px", lineHeight: 1.6 }}>
                {t("Ingresa tu código de atleta para ver tu información asignada.")}
              </p>
              <div style={{ display: "grid", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: "8px" }}>{t("Código de atleta")}</span>
                  <input
                    value={athleteId}
                    onChange={(e) => setAthleteId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadAthlete()}
                    placeholder={t("Ingresa tu código")}
                    style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.9)", fontSize: "15px", outline: "none", fontWeight: 500, boxSizing: "border-box" }}
                  />
                </div>
                <button type="button" onClick={loadAthlete} disabled={loading}
                  style={{ width: "100%", padding: "17px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg,#d4a843 0%,#c9a84c 50%,#b8933a 100%)", color: "#0d1b3e", fontSize: "16px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, letterSpacing: "0.03em", boxShadow: "0 4px 20px rgba(201,168,76,0.4)" }}>
                  {loading ? t("Cargando...") : t("Ver mi información")}
                </button>
                {error && <p style={{ color: "#fca5a5", fontSize: "13px", textAlign: "center" }}>{error}</p>}
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
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>{t("Perfil")}</p>
                <h2 className="font-sans font-bold text-2xl mt-1" style={{ color: "var(--text)" }}>{athlete.fullName}</h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{athlete.countryCode || ""}</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("Tipo de usuario")}: {athlete.userType || "-"}</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("Evento")}: {event?.name || "-"}</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {t("Delegación")}: {delegation ? countryLabels[delegation.countryCode] || delegation.countryCode : "-"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="badge badge-emerald">{athlete.status || "REGISTERED"}</div>
                <button className="btn btn-ghost" onClick={() => { setAthlete(null); setAthleteId(""); }}>
                  {t("Volver")}
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl p-4" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>{t("Vuelo")}</p>
                <p className="text-sm font-medium mt-1" style={{ color: "var(--text)" }}>
                  {flight ? `${flight.airline} · ${flight.flightNumber}` : "-"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {t("Arribo")}: {formatDate(athlete.arrivalTime || flight?.arrivalTime)}
                </p>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>{t("Hotel")}</p>
                <p className="text-sm font-medium mt-1" style={{ color: "var(--text)" }}>{hotel?.name || "-"}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{t("Habitación")}: {athlete.roomNumber || "-"}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {t("Tipo de habitación")}: {athlete.roomType || "-"} · {t("Cama")}: {athlete.bedType || "-"}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("Equipaje")}: {athlete.luggageType || "-"}</p>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>{t("Transporte")}</p>
                <p className="text-sm font-medium mt-1" style={{ color: "var(--text)" }}>{t("Conductor")}: {driver?.fullName || "-"}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {t("Vehículo")}: {vehicle ? `${vehicle.type} · ${vehicle.plate}` : "-"}
                </p>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>{t("Check-ins")}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{t("Aeropuerto")}: {formatDate(athlete.airportCheckinAt)}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("Hotel")}: {formatDate(athlete.hotelCheckinAt)}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("Check-out")}: {formatDate(athlete.hotelCheckoutAt)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/portal/athlete/salud?id=${athlete.id}`}
                className="btn btn-primary flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t("Ficha de salud")}
              </Link>
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

            {error && <p className="text-sm text-rose-600">{error}</p>}
          </section>
          </div>
        </div>
      )}
    </>
  );
}
