"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Accommodation = {
  id: string;
  eventId?: string | null;
  name?: string | null;
  totalCapacity?: number | null;
  address?: string | null;
  roomInventory?: Record<string, number>;
  bedInventory?: Record<string, number>;
};

type Athlete = {
  id: string;
  fullName?: string | null;
  hotelAccommodationId?: string | null;
  roomType?: string | null;
  bedType?: string | null;
};

type EventItem = { id: string; name?: string | null };

const formatPercent = (value: number) => `${Math.round(value)}%`;

export default function HotelTrackingPage() {
  const { t } = useI18n();
  const [hotels, setHotels] = useState<Accommodation[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hotelData, athleteData, eventData] = await Promise.all([
        apiFetch<Accommodation[]>("/accommodations"),
        apiFetch<Athlete[]>("/athletes"),
        apiFetch<EventItem[]>("/events")
      ]);

      setHotels(hotelData || []);
      setAthletes(athleteData || []);
      setEvents(
        (eventData || []).reduce<Record<string, EventItem>>((acc, event) => {
          acc[event.id] = event;
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

  const rows = useMemo(() => {
    return hotels
      .map((hotel) => {
        const assigned = athletes.filter(
          (athlete) => athlete.hotelAccommodationId === hotel.id
        ).length;
        const total = hotel.totalCapacity ?? 0;
        const available = Math.max(total - assigned, 0);
        const occupancy = total > 0 ? (assigned / total) * 100 : 0;
        const roomInventory = hotel.roomInventory ?? {};
        const bedInventory = hotel.bedInventory ?? {};
        const roomTypes = Object.keys(roomInventory);
        const bedTypes = Object.keys(bedInventory);
        const roomUsage = roomTypes.map((type) => {
          const totalRooms = roomInventory[type] ?? 0;
          return {
            type,
            total: totalRooms
          };
        });
        const bedUsage = bedTypes.map((type) => {
          const totalBeds = bedInventory[type] ?? 0;
          const usedBeds = athletes.filter(
            (athlete) =>
              athlete.hotelAccommodationId === hotel.id &&
              athlete.bedType === type
          ).length;
          return {
            type,
            total: totalBeds,
            used: usedBeds,
            available: Math.max(totalBeds - usedBeds, 0)
          };
        });
        return {
          ...hotel,
          assigned,
          available,
          occupancy,
          roomUsage,
          bedUsage
        };
      })
      .sort((a, b) => (b.occupancy ?? 0) - (a.occupancy ?? 0));
  }, [hotels, athletes]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking hotelería"
        description="Disponibilidad en tiempo real por hotel y ocupación."
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
        <h2 className="font-display text-2xl text-ink mb-4">{t("Disponibilidad")}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">{t("Sin hoteles registrados.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Hotel")}</th>
                  <th>{t("Evento")}</th>
                  <th>{t("Dirección")}</th>
                  <th>{t("Capacidad")}</th>
                  <th>{t("Ocupadas")}</th>
                  <th>{t("Disponibles")}</th>
                  <th>{t("Habitaciones")}</th>
                  <th>{t("Camas")}</th>
                  <th>{t("Ocupación")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const eventName = row.eventId ? events[row.eventId]?.name : "-";
                  const occupancy = row.occupancy ?? 0;
                  return (
                    <tr key={row.id}>
                      <td>{row.name || row.id}</td>
                      <td>{eventName || row.eventId || "-"}</td>
                      <td>{row.address || "-"}</td>
                      <td>{row.totalCapacity ?? 0}</td>
                      <td>{row.assigned}</td>
                      <td>{row.available}</td>
                      <td>
                        {row.roomUsage.length === 0 ? (
                          "-"
                        ) : (
                          <div className="space-y-1 text-xs text-slate-500">
                            {row.roomUsage.map((room) => (
                              <div key={room.type}>
                                {room.type}: {room.total}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {row.bedUsage.length === 0 ? (
                          "-"
                        ) : (
                          <div className="space-y-1 text-xs text-slate-500">
                            {row.bedUsage.map((bed) => (
                              <div key={bed.type}>
                                {bed.type}: {bed.available}/{bed.total}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${Math.min(occupancy, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{formatPercent(occupancy)}</span>
                        </div>
                      </td>
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
