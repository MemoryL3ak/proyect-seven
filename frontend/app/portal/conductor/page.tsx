"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Trip = {
  id: string;
  driverId: string;
  eventId?: string | null;
  vehicleId: string;
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
        (athletesData || []).reduce<Record<string, AthleteItem>>((acc, athlete) => {
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
      if (status === "EN_ROUTE") {
        payload.startedAt = new Date().toISOString();
      }
      if (status === "PICKED_UP" && !payload.startedAt) {
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
    (trip.athleteIds || []).forEach((athleteId) => {
      const suffix = athleteId.slice(-4);
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
        const suffix = lead.id.slice(-4);
        if (suffix) candidates.add(suffix);
      }
    });
    return candidates;
  };

  const confirmPickup = (trip: Trip) => {
    setPickupTrip(trip);
    setPickupCode("");
    setPickupError(null);
  };

  const submitPickupCode = async () => {
    if (!pickupTrip) return;
    const normalized = pickupCode.trim();
    if (normalized.length < 4) {
      setPickupError(t("El código ingresado no es válido."));
      return;
    }
    const last4 = normalized.slice(-4);
    const candidates = getPickupCandidates(pickupTrip);
    if (!candidates.has(last4)) {
      setPickupError(t("El código no coincide con el ID del encargado o participante."));
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
            {t("Tu código de acceso")}
            <input
              className="input"
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              placeholder={t("Ingresa código")}
            />
          </label>
          <button className="btn btn-primary w-fit" onClick={loadTrips} disabled={loading}>
            {loading ? t("Cargando...") : t("Ver mis viajes")}
          </button>
          {idError && <p className="text-sm text-rose-600">{idError}</p>}
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
            <div className="glass rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("Proveedor")}</p>
              <p className="text-sm text-slate-600">
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
      )}

      {driverProfile && (
        <section className="surface rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-2xl text-ink">{t("Viajes asignados")}</h2>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-500">
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
              <label className="flex items-center gap-2 text-sm text-slate-500">
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
            <p className="text-sm text-slate-500">{t("No hay viajes asignados aún.")}</p>
          ) : (
            <div className="space-y-4">
              {filteredTrips.map((trip) => {
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
                      <div className="text-xs text-slate-500">
                        {t("Costo de viaje")}: {formatCurrencyCLP(trip.tripCost)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t("Origen")}:{" "}
                        {trip.origin ? (
                          <a
                            className="text-emerald-700 hover:underline"
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
                      <div className="text-xs text-slate-500">
                        {t("Destino")}:{" "}
                        {trip.destination ? (
                          <a
                            className="text-emerald-700 hover:underline"
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
                      <div className="text-xs text-slate-500">{t("Delegación")}: {resolveDelegations(trip)}</div>
                      <div className="text-xs text-slate-500">{t("Encargado de delegaci\u00f3n")}: {resolveDelegationLeads(trip)}</div>
                      <div className="text-xs text-slate-500">{t("Participantes")}: {(trip.athleteIds || []).length}</div>
                    </div>

                    <div className="text-xs text-slate-500">
                      {t("Inicio")}: {formatDate(trip.startedAt)} | {t("Cierre")}: {formatDate(trip.completedAt)}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-ghost" onClick={() => updateTrip(trip.id, "EN_ROUTE")}>
                        {t("En ruta a recoger")}
                      </button>
                      <button className="btn btn-primary" onClick={() => confirmPickup(trip)}>
                        {t("Recogido")}
                      </button>
                      {trip.tripType !== "SERVICE" && (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="surface w-full max-w-md rounded-3xl p-6 shadow-xl">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {t("Código de verificación")}
              </p>
              <h3 className="font-display text-2xl text-ink">{t("Recogido")}</h3>
              <p className="text-sm text-slate-500">
                {t("Ingresa los últimos 4 dígitos del ID del encargado o participante.")}
              </p>
            </div>
            <label className="flex flex-col gap-2 text-sm text-slate-600 mt-4">
              {t("Últimos 4 dígitos")}
              <input
                className="input"
                value={pickupCode}
                onChange={(event) => setPickupCode(event.target.value)}
                placeholder="0000"
                inputMode="numeric"
                maxLength={8}
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
    </div>
  );
}
