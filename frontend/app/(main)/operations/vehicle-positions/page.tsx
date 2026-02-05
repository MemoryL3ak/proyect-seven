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

type PositionItem = {
  id: string;
  vehicleId: string;
  timestamp: string;
  location?: { coordinates?: [number, number] } | { lat?: number; lng?: number };
};

const statusLabel: Record<string, string> = {
  EN_ROUTE: "En ruta a recoger",
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

const tripTypeLabels: Record<string, string> = {
  TRANSFER_IN_OUT: "Transfer In Out",
  DISPOSICION_12H: "Disposición 12 horas",
  IDA_VUELTA: "Viaje Ida-Vuelta"
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-CL") : "-";

const formatTripType = (value?: string | null) => {
  if (!value) return "-";
  return tripTypeLabels[value] ?? value;
};

export default function VehiclePositionsPage() {
  const { t } = useI18n();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [drivers, setDrivers] = useState<Record<string, DriverItem>>({});
  const [vehicles, setVehicles] = useState<Record<string, VehicleItem>>({});
  const [athletes, setAthletes] = useState<Record<string, AthleteItem>>({});
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number; timestamp: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mapPreview, setMapPreview] = useState<{
    lat: number;
    lng: number;
    title: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tripData, eventData, driverData, vehicleData, athleteData, delegationData, positionData] =
        await Promise.all([
          apiFetch<Trip[]>("/trips"),
          apiFetch<EventItem[]>("/events"),
          apiFetch<DriverItem[]>("/drivers"),
          apiFetch<VehicleItem[]>("/transports"),
          apiFetch<AthleteItem[]>("/athletes"),
          apiFetch<DelegationItem[]>("/delegations"),
          apiFetch<PositionItem[]>("/vehicle-positions")
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

      const latestByVehicle: Record<string, { lat: number; lng: number; timestamp: string }> = {};
      (positionData || []).forEach((pos) => {
        const coordinates = (pos.location as any)?.coordinates;
        const lat = coordinates ? coordinates[1] : (pos.location as any)?.lat;
        const lng = coordinates ? coordinates[0] : (pos.location as any)?.lng;
        if (lat === undefined || lng === undefined) return;
        const current = latestByVehicle[pos.vehicleId];
        if (!current || new Date(pos.timestamp) > new Date(current.timestamp)) {
          latestByVehicle[pos.vehicleId] = { lat, lng, timestamp: pos.timestamp };
        }
      });
      setPositions(latestByVehicle);

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

  const buildMapEmbed = (lat: number, lng: number) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}&zoom=16`;
    }
    const delta = 0.01;
    const left = lng - delta;
    const right = lng + delta;
    const top = lat + delta;
    const bottom = lat - delta;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
  };

  const buildGoogleMapsLink = (lat: number, lng: number) =>
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

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
                  <th>{t("Mapa")}</th>
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
                  const position = positions[trip.vehicleId];
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
                      <td>
                        {position ? (
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              className="w-56 h-36 rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition"
                              onClick={() =>
                                setMapPreview({
                                  lat: position.lat,
                                  lng: position.lng,
                                  title: vehicle?.plate || trip.vehicleId
                                })
                              }
                            >
                              <iframe
                                title={`map-${trip.id}`}
                                src={buildMapEmbed(position.lat, position.lng)}
                                className="w-full h-full"
                                loading="lazy"
                              />
                            </button>
                            <a
                              className="text-xs font-semibold text-emerald-700 hover:underline"
                              href={buildGoogleMapsLink(position.lat, position.lng)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t("Ver en Google Maps")}
                            </a>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>{formatTripType(trip.tripType)}</td>
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

      {mapPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="surface w-full max-w-4xl rounded-3xl p-4 shadow-2xl">
            <div className="flex items-center justify-between px-2 pb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {t("Tracking de viajes")}
                </p>
                <h3 className="font-display text-xl text-ink">{mapPreview.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  className="btn btn-ghost"
                  href={buildGoogleMapsLink(mapPreview.lat, mapPreview.lng)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("Ver en Google Maps")}
                </a>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => setMapPreview(null)}
                >
                  {t("Cerrar")}
                </button>
              </div>
            </div>
            <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-200">
              <iframe
                title="map-preview"
                src={buildMapEmbed(mapPreview.lat, mapPreview.lng)}
                className="h-full w-full"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
