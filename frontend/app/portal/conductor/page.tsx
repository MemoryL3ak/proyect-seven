"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Trip = {
  id: string;
  driverId: string;
  eventId?: string | null;
  vehicleId: string;
  origin?: string | null;
  destination?: string | null;
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
};

type EventItem = { id: string; name?: string | null };

type VehicleItem = { id: string; plate?: string | null; type?: string | null; brand?: string | null; model?: string | null };

type DelegationItem = { id: string; countryCode?: string | null };

type AthleteItem = {
  id: string;
  fullName?: string | null;
  delegationId?: string | null;
};

const statusLabel: Record<string, string> = {
  SCHEDULED: "Programado",
  PICKED_UP: "Recogido",
  DROPPED_OFF: "Dejado en hotel",
  COMPLETED: "Completado"
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

export default function DriverPortalPage() {
  const { t } = useI18n();
  const [driverId, setDriverId] = useState("");
  const [driverProfile, setDriverProfile] = useState<Driver | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [vehicles, setVehicles] = useState<Record<string, VehicleItem>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [athletes, setAthletes] = useState<Record<string, AthleteItem>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);

  const loadTrips = async () => {
    if (!driverId) return;
    setLoading(true);
    setError(null);
    try {
      const [tripsData, driversData, eventsData, vehiclesData, delegationsData, athletesData] =
        await Promise.all([
          apiFetch<Trip[]>("/trips"),
          apiFetch<Driver[]>("/drivers"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<VehicleItem[]>("/transports"),
          apiFetch<DelegationItem[]>("/delegations"),
          apiFetch<AthleteItem[]>("/athletes")
        ]);

      const driverMatch = (driversData || []).find(
        (driver) => driver.userId === driverId || driver.id === driverId
      );
      setDriverProfile(driverMatch ?? null);

      const filteredTrips = (tripsData || []).filter((trip) => trip.driverId === driverId);
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
        (athletesData || []).reduce<Record<string, AthleteItem>>((acc, athlete) => {
          acc[athlete.id] = athlete;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo actualizar"));
    } finally {
      setLoading(false);
    }
  };

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

  const resolveAthletes = (trip: Trip) => {
    if (trip.athleteNames && trip.athleteNames.length > 0) {
      return trip.athleteNames.join(", ");
    }
    const names = (trip.athleteIds || [])
      .map((athleteId) => athletes[athleteId]?.fullName)
      .filter((value): value is string => Boolean(value));
    return names.length > 0 ? names.join(", ") : "-";
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
    <div className="space-y-6">
      <section className="glass rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Seven</p>
        <h1 className="font-display text-3xl text-ink">{t("Portal Conductor")}</h1>
        <p className="text-sm text-slate-500 mt-2">{t("Revisa tus viajes y reporta cada etapa del traslado.")}</p>
      </section>

      {!driverProfile && (
        <section className="surface rounded-3xl p-6 space-y-4">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("Solicita tu código")}
            </p>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              {t("Correo electrónico")}
              <input
                className="input"
                value={requestEmail}
                onChange={(event) => setRequestEmail(event.target.value)}
                placeholder="email@dominio.com"
                type="email"
              />
            </label>
            <button
              className="btn btn-ghost w-fit"
              onClick={requestAccess}
              disabled={requestLoading}
            >
              {requestLoading ? t("Enviando...") : t("Solicita tu código")}
            </button>
            {requestStatus && <p className="text-sm text-emerald-600">{requestStatus}</p>}
            {requestError && <p className="text-sm text-rose-600">{requestError}</p>}
          </div>

          <label className="flex flex-col gap-2 text-sm text-slate-600">
            {t("Tu ID de conductor")}
            <input
              className="input"
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              placeholder="UUID"
            />
          </label>
          <button className="btn btn-primary w-fit" onClick={loadTrips} disabled={loading}>
            {loading ? t("Cargando...") : t("Ver mis viajes")}
          </button>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </section>
      )}

      {driverProfile && (
        <section className="surface rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("Perfil")}</p>
                <h2 className="font-display text-2xl text-ink">
                  {driverProfile?.fullName || t("Conductor")}
                </h2>
                <p className="text-sm text-slate-500">RUT: {driverProfile?.rut || "-"}</p>
              </div>
              {driverProfile?.photoUrl ? (
                <img
                  src={driverProfile.photoUrl}
                  alt={t("Foto conductor")}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                  {t("Sin foto")}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
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
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("Correo")}</p>
              <p className="text-sm text-slate-600">{driverProfile?.email || "-"}</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("ID de conductor")}</p>
              <p className="text-sm text-slate-600">{driverProfile?.userId || driverProfile?.id || "-"}</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("Vehículo")}</p>
              <p className="text-sm text-slate-600">
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
          </div>
        </section>
      )}

      {driverProfile && (
        <section className="surface rounded-3xl p-6">
          <h2 className="font-display text-2xl text-ink mb-4">{t("Viajes asignados")}</h2>
          {trips.length === 0 ? (
            <p className="text-sm text-slate-500">{t("No hay viajes asignados aún.")}</p>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => {
                const event = trip.eventId ? events[trip.eventId] : null;
                const vehicle = vehicles[trip.vehicleId];
                return (
                  <div key={trip.id} className="glass rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("Viaje")}</p>
                        <p className="text-sm text-slate-600">{trip.id}</p>
                        <p className="text-xs text-slate-500">
                          {t("Evento")}: {event?.name || trip.eventId || "-"}
                        </p>
                      </div>
                      <div className="badge badge-amber">
                        {statusLabel[trip.status || "SCHEDULED"] || trip.status}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="text-xs text-slate-500">
                        {t("Vehículo")}: {vehicle?.plate || trip.vehicleId}
                        {vehicle?.type ? ` (${vehicle.type})` : ""}
                        {vehicle?.brand || vehicle?.model
                          ? ` · ${[vehicle?.brand, vehicle?.model].filter(Boolean).join(" ")}`
                          : ""}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t("Programación")}: {formatDate(trip.scheduledAt)}
                      </div>
                      <div className="text-xs text-slate-500">{t("Origen")}: {trip.origin || "-"}</div>
                      <div className="text-xs text-slate-500">{t("Destino")}: {trip.destination || "-"}</div>
                      <div className="text-xs text-slate-500">{t("Delegación")}: {resolveDelegations(trip)}</div>
                      <div className="text-xs text-slate-500">{t("Participantes")}: {resolveAthletes(trip)}</div>
                    </div>

                    <div className="text-xs text-slate-500">
                      {t("Inicio")}: {formatDate(trip.startedAt)} | {t("Cierre")}: {formatDate(trip.completedAt)}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-primary" onClick={() => updateTrip(trip.id, "PICKED_UP")}>
                        {t("Recogido")}
                      </button>
                      <button className="btn btn-primary" onClick={() => updateTrip(trip.id, "DROPPED_OFF")}>
                        {t("Dejado en hotel")}
                      </button>
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
    </div>
  );
}
