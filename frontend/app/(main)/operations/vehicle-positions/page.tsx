"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Trip = {
  id: string;
  eventId?: string | null;
  driverId: string;
  vehicleId: string;
  origin?: string | null;
  destination?: string | null;
  tripType?: string | null;
  clientType?: string | null;
  status?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  athleteIds?: string[];
  athleteNames?: string[];
};

type EventItem = { id: string; name?: string | null };

type DriverItem = { id: string; userId?: string | null; fullName?: string | null };

type VehicleItem = { id: string; plate?: string | null; type?: string | null; brand?: string | null; model?: string | null };

type AthleteItem = { id: string; fullName?: string | null; delegationId?: string | null };

type DelegationItem = { id: string; countryCode?: string | null };

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

export default function VehiclePositionsPage() {
  const { t } = useI18n();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [drivers, setDrivers] = useState<Record<string, DriverItem>>({});
  const [vehicles, setVehicles] = useState<Record<string, VehicleItem>>({});
  const [athletes, setAthletes] = useState<Record<string, AthleteItem>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tripData, eventData, driverData, vehicleData, athleteData, delegationData] =
        await Promise.all([
          apiFetch<Trip[]>("/trips"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<DriverItem[]>("/drivers"),
          apiFetch<VehicleItem[]>("/transports"),
          apiFetch<AthleteItem[]>("/athletes"),
          apiFetch<DelegationItem[]>("/delegations")
        ]);

      setTrips(tripData || []);

      setEvents(
        (eventData || []).reduce<Record<string, EventItem>>((acc, event) => {
          acc[event.id] = event;
          return acc;
        }, {})
      );

      setDrivers(
        (driverData || []).reduce<Record<string, DriverItem>>((acc, driver) => {
          if (driver.userId) acc[driver.userId] = driver;
          acc[driver.id] = driver;
          return acc;
        }, {})
      );

      setVehicles(
        (vehicleData || []).reduce<Record<string, VehicleItem>>((acc, vehicle) => {
          acc[vehicle.id] = vehicle;
          return acc;
        }, {})
      );

      setAthletes(
        (athleteData || []).reduce<Record<string, AthleteItem>>((acc, athlete) => {
          acc[athlete.id] = athlete;
          return acc;
        }, {})
      );

      setDelegations(
        (delegationData || []).reduce<Record<string, DelegationItem>>((acc, delegation) => {
          acc[delegation.id] = delegation;
          return acc;
        }, {})
      );

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cargar"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, []);

  const orderedTrips = useMemo(() => {
    return [...trips].sort((a, b) => {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [trips]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking de viajes"
        description="Monitoreo de viajes en curso y estado operativo."
      />

      <section className="surface rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {t("Última actualización")}: {lastUpdated ? lastUpdated.toLocaleTimeString("es-CL") : "-"}
          </div>
          <button className="btn btn-ghost" onClick={loadData} disabled={loading}>
            {loading ? t("Actualizando...") : t("Refrescar")}
          </button>
        </div>
        {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
      </section>

      <section className="surface rounded-2xl p-6">
        <h2 className="font-display text-2xl text-ink mb-4">{t("Viajes")}</h2>
        {orderedTrips.length === 0 ? (
          <p className="text-sm text-slate-500">{t("Sin viajes registrados.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Viaje")}</th>
                  <th>{t("Evento")}</th>
                  <th>{t("Conductor")}</th>
                  <th>{t("Vehículo")}</th>
                  <th>{t("Tipo")}</th>
                  <th>{t("Cliente")}</th>
                  <th>{t("Origen")}</th>
                  <th>{t("Destino")}</th>
                  <th>{t("Delegación")}</th>
                  <th>{t("Participantes")}</th>
                  <th>{t("Programación")}</th>
                  <th>{t("Inicio")}</th>
                  <th>{t("Cierre")}</th>
                  <th>{t("Estado")}</th>
                </tr>
              </thead>
              <tbody>
                {orderedTrips.map((trip) => {
                  const event = trip.eventId ? events[trip.eventId] : null;
                  const driver = drivers[trip.driverId];
                  const vehicle = vehicles[trip.vehicleId];
                  return (
                    <tr key={trip.id}>
                      <td>{trip.id}</td>
                      <td>{event?.name || trip.eventId || "-"}</td>
                      <td>{driver?.fullName || trip.driverId}</td>
                      <td>
                        {vehicle?.plate || trip.vehicleId}
                        {vehicle?.type ? ` (${vehicle.type})` : ""}
                        {vehicle?.brand || vehicle?.model
                          ? ` · ${[vehicle?.brand, vehicle?.model].filter(Boolean).join(" ")}`
                          : ""}
                      </td>
                      <td>{trip.tripType || "-"}</td>
                      <td>{trip.clientType || "-"}</td>
                      <td>{trip.origin || "-"}</td>
                      <td>{trip.destination || "-"}</td>
                      <td>{resolveDelegations(trip)}</td>
                      <td>{resolveAthletes(trip)}</td>
                      <td>{formatDate(trip.scheduledAt)}</td>
                      <td>{formatDate(trip.startedAt)}</td>
                      <td>{formatDate(trip.completedAt)}</td>
                      <td>{statusLabel[trip.status || "SCHEDULED"] || trip.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
