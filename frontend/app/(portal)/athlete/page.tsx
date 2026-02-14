"use client";

import { useState } from "react";
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

type HotelAssignment = {
  id: string;
  participantId?: string;
  participant_id?: string;
  checkinAt?: string | null;
  checkin_at?: string | null;
  checkoutAt?: string | null;
  checkout_at?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
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
  value &&
  value !== "null" &&
  value !== "undefined" &&
  !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleString()
    : "-";

const normalizeHotelAssignment = (item: HotelAssignment) => ({
  id: item.id,
  participantId: item.participantId ?? item.participant_id ?? "",
  checkinAt:
    item.checkinAt === "null" || item.checkin_at === "null"
      ? null
      : (item.checkinAt ?? item.checkin_at ?? null),
  checkoutAt:
    item.checkoutAt === "null" || item.checkout_at === "null"
      ? null
      : (item.checkoutAt ?? item.checkout_at ?? null),
  createdAt: item.createdAt ?? item.created_at ?? "",
  updatedAt: item.updatedAt ?? item.updated_at ?? "",
});

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
  const [hotelAssignment, setHotelAssignment] = useState<{
    checkinAt?: string | null;
    checkoutAt?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAthlete = async () => {
    if (!athleteId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Athlete>(`/athletes/${athleteId}`);
      setAthlete(data);

      const [
        flightData,
        hotelData,
        vehicleData,
        tripData,
        eventData,
        delegationData,
        hotelAssignments
      ] = await Promise.all([
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
          : Promise.resolve(null),
        apiFetch<HotelAssignment[]>(`/hotel-assignments`)
      ]);

      setFlight(flightData);
      setHotel(hotelData);
      setVehicle(vehicleData);
      setEvent(eventData);
      setDelegation(delegationData);
      const assignmentCandidates = (hotelAssignments || [])
        .map((item) => normalizeHotelAssignment(item))
        .filter((item) => item.participantId === data.id)
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime()
        );
      const assignment = assignmentCandidates[0] ?? null;
      setHotelAssignment(assignment);

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
      setHotelAssignment(null);
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
    <div className="space-y-6">
      <section className="glass rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Seven</p>
        <h1 className="font-display text-3xl text-ink">{t("Portal de usuario")}</h1>
        <p className="text-sm text-slate-500 mt-2">{t("Consulta tu itinerario y confirma cada etapa del viaje.")}</p>
      </section>

      <section className="surface rounded-3xl p-6 space-y-4">
        <label className="flex flex-col gap-2 text-sm text-slate-600">
          {t("Tu ID de usuario")}
          <input
            className="input"
            value={athleteId}
            onChange={(event) => setAthleteId(event.target.value)}
            placeholder="UUID"
          />
        </label>
        <button className="btn btn-primary w-fit" onClick={loadAthlete} disabled={loading}>
          {loading ? t("Cargando...") : t("Ver mi información")}
        </button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </section>

      {athlete && (
        <section className="surface rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Perfil</p>
              <h2 className="font-display text-2xl text-ink">{athlete.fullName}</h2>
              <p className="text-sm text-slate-500">{athlete.countryCode || ""}</p>
              <p className="text-sm text-slate-500">{t("Tipo de usuario")}: {athlete.userType || "-"}</p>
              <p className="text-sm text-slate-500">{t("Evento")}: {event?.name || "-"}</p>
              <p className="text-sm text-slate-500">
                {t("Delegación")}: {delegation ? countryLabels[delegation.countryCode] || delegation.countryCode : "-"}
              </p>
            </div>
            <div className="badge badge-emerald">{athlete.status || "REGISTERED"}</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("Vuelo")}</p>
              <p className="text-sm text-slate-600">
                {flight ? `${flight.airline} · ${flight.flightNumber}` : "-"}
              </p>
              <p className="text-sm text-slate-500">
                {t("Arribo")}: {formatDate(athlete.arrivalTime || flight?.arrivalTime)}
              </p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("Hotel")}</p>
              <p className="text-sm text-slate-600">{hotel?.name || "-"}</p>
              <p className="text-sm text-slate-500">{t("Habitación")}: {athlete.roomNumber || "-"}</p>
              <p className="text-sm text-slate-500">
                {t("Tipo de habitación")}: {athlete.roomType || "-"} · {t("Cama")}: {athlete.bedType || "-"}
              </p>
              <p className="text-sm text-slate-500">{t("Equipaje")}: {athlete.luggageType || "-"}</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("Transporte")}</p>
              <p className="text-sm text-slate-600">{t("Conductor")}: {driver?.fullName || "-"}</p>
              <p className="text-sm text-slate-500">
                {t("Vehículo")}: {vehicle ? `${vehicle.type} · ${vehicle.plate}` : "-"}
              </p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("Check-ins")}</p>
              <p className="text-sm text-slate-500">{t("Aeropuerto")}: {formatDate(athlete.airportCheckinAt)}</p>
              <p className="text-sm text-slate-500">{t("Hotel")}: {formatDate(hotelAssignment?.checkinAt)}</p>
              <p className="text-sm text-slate-500">{t("Check-out")}: {formatDate(hotelAssignment?.checkoutAt)}</p>
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
      )}
    </div>
  );
}
