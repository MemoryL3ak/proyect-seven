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

type HotelRoom = {
  id: string;
  hotelId?: string | null;
  roomType?: string | null;
};

type HotelBed = {
  id: string;
  roomId?: string | null;
  bedType?: string | null;
  status?: string | null;
  hotelId?: string | null;
};

type HotelAssignment = {
  id: string;
  participantId?: string | null;
  hotelId?: string | null;
  roomId?: string | null;
  bedId?: string | null;
  status?: string | null;
};

type Athlete = {
  id: string;
  fullName?: string | null;
  eventId?: string | null;
  hotelAccommodationId?: string | null;
  roomType?: string | null;
  bedType?: string | null;
};

type EventItem = { id: string; name?: string | null };

const formatPercent = (value: number) => `${Math.round(value)}%`;

export default function HotelTrackingPage() {
  const { t } = useI18n();
  const [hotels, setHotels] = useState<Accommodation[]>([]);
  const [hotelRooms, setHotelRooms] = useState<HotelRoom[]>([]);
  const [hotelBeds, setHotelBeds] = useState<HotelBed[]>([]);
  const [hotelAssignments, setHotelAssignments] = useState<HotelAssignment[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [events, setEvents] = useState<Record<string, EventItem>>({});
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hotelData, athleteData, eventData, roomsData, bedsData, assignmentsData] = await Promise.all([
        apiFetch<Accommodation[]>("/accommodations"),
        apiFetch<Athlete[]>("/athletes"),
        apiFetch<EventItem[]>("/events"),
        apiFetch<HotelRoom[]>("/hotel-rooms"),
        apiFetch<HotelBed[]>("/hotel-beds"),
        apiFetch<HotelAssignment[]>("/hotel-assignments")
      ]);

      setHotels(hotelData || []);
      setAthletes(athleteData || []);
      setHotelRooms(roomsData || []);
      setHotelBeds(bedsData || []);
      setHotelAssignments(assignmentsData || []);
      setEvents(
        (eventData || []).reduce<Record<string, EventItem>>((acc, event) => {
          acc[event.id] = event;
          return acc;
        }, {})
      );
      if (!selectedEventId && eventData && eventData.length > 0) {
        setSelectedEventId(eventData[0].id);
      }
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
    const filteredHotels = selectedEventId
      ? hotels.filter((hotel) => hotel.eventId === selectedEventId)
      : hotels;
    const filteredAthletes = selectedEventId
      ? athletes.filter((athlete) => athlete.eventId === selectedEventId)
      : athletes;
    const athleteById = new Map(filteredAthletes.map((athlete) => [athlete.id, athlete]));
    const filteredAssignments = hotelAssignments.filter((assignment) => {
      if (!assignment.participantId) return false;
      if (!selectedEventId) return true;
      const athlete = athleteById.get(assignment.participantId);
      return athlete?.eventId === selectedEventId;
    });

    const roomById = new Map(hotelRooms.map((room) => [room.id, room]));
    const roomsByHotel = hotelRooms.reduce<Record<string, HotelRoom[]>>((acc, room) => {
      const hotelId = room.hotelId;
      if (!hotelId) return acc;
      acc[hotelId] = acc[hotelId] ? [...acc[hotelId], room] : [room];
      return acc;
    }, {});
    const bedsByHotel = hotelBeds.reduce<Record<string, HotelBed[]>>((acc, bed) => {
      const room = bed.roomId ? roomById.get(bed.roomId) : null;
      const hotelId = room?.hotelId;
      if (!hotelId) return acc;
      acc[hotelId] = acc[hotelId] ? [...acc[hotelId], bed] : [bed];
      return acc;
    }, {});

    return filteredHotels
      .map((hotel) => {
        const assigned = filteredAssignments.filter(
          (assignment) => assignment.hotelId === hotel.id
        ).length;
        const hotelRoomList = roomsByHotel[hotel.id] || [];
        const hotelBedList = bedsByHotel[hotel.id] || [];
        const total = hotelRoomList.length;
        const available = Math.max(total - assigned, 0);
        const occupancy = total > 0 ? (assigned / total) * 100 : 0;
        const roomUsage = hotelRoomList.reduce<Record<string, number>>(
          (acc, room) => {
            const type = room.roomType ?? "SIN_TIPO";
            acc[type] = (acc[type] ?? 0) + 1;
            return acc;
          },
          {}
        );
        const bedUsage = hotelBedList.reduce<Record<string, number>>(
          (acc, bed) => {
            const type = bed.bedType ?? "SIN_TIPO";
            acc[type] = (acc[type] ?? 0) + 1;
            return acc;
          },
          {}
        );
        const roomUsageList = Object.entries(roomUsage).map(([type, totalRooms]) => ({
          type,
          total: totalRooms
        }));
        const bedUsageList = Object.entries(bedUsage).map(([type, totalBeds]) => {
          const usedBeds = filteredAssignments.filter((assignment) => {
            if (assignment.hotelId !== hotel.id) return false;
            if (!assignment.participantId) return false;
            const athlete = athleteById.get(assignment.participantId);
            return athlete?.bedType === type;
          }).length;
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
          roomUsage: roomUsageList,
          bedUsage: bedUsageList,
          totalCapacity: total
        };
      })
      .sort((a, b) => (b.occupancy ?? 0) - (a.occupancy ?? 0));
  }, [hotels, athletes, selectedEventId, hotelRooms, hotelBeds, hotelAssignments]);

  const overview = useMemo(() => {
    const activeHotels = selectedEventId
      ? hotels.filter((hotel) => hotel.eventId === selectedEventId)
      : hotels;
    const roomById = new Map(hotelRooms.map((room) => [room.id, room]));

    const filteredAthletes = selectedEventId
      ? athletes.filter((athlete) => athlete.eventId === selectedEventId)
      : athletes;
    const athleteById = new Map(filteredAthletes.map((athlete) => [athlete.id, athlete]));
    const filteredAssignments = hotelAssignments.filter((assignment) => {
      if (!assignment.participantId) return false;
      if (!selectedEventId) return true;
      const athlete = athleteById.get(assignment.participantId);
      return athlete?.eventId === selectedEventId;
    });

    const totalParticipants = filteredAthletes.length;

    const assignedParticipants = filteredAssignments.filter((assignment) =>
      activeHotels.some((hotel) => hotel.id === assignment.hotelId)
    ).length;

    const totalRooms = activeHotels.reduce((sum, hotel) => {
      const rooms = hotelRooms.filter((room) => room.hotelId === hotel.id).length;
      return sum + rooms;
    }, 0);

    const totalBeds = activeHotels.reduce((sum, hotel) => {
      const beds = hotelBeds.filter((bed) => {
        const room = bed.roomId ? roomById.get(bed.roomId) : null;
        return room?.hotelId === hotel.id;
      }).length;
      return sum + beds;
    }, 0);

    const unassignedParticipants = Math.max(
      totalParticipants - assignedParticipants,
      0
    );

    return {
      totalParticipants,
      assignedParticipants,
      unassignedParticipants,
      totalRooms,
      totalBeds,
      hotelsCount: activeHotels.length
    };
  }, [selectedEventId, hotels, athletes, hotelRooms, hotelBeds, hotelAssignments]);

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
          <div className="flex items-center gap-3">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("Evento")}
            </label>
            <select
              className="input h-10 flex-1 min-w-[420px] leading-5"
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
            >
              <option value="">{t("Todos")}</option>
              {Object.values(events).map((eventItem) => (
                <option key={eventItem.id} value={eventItem.id}>
                  {eventItem.name || eventItem.id}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-ghost" onClick={loadData} disabled={loading}>
            {loading ? t("Actualizando...") : t("Refrescar")}
          </button>
        </div>
        {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
      </section>

      <section className="surface rounded-2xl p-6">
        <h2 className="font-display text-2xl text-ink mb-4">{t("Overview")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("Participantes registrados")}
            </p>
            <p className="text-2xl font-semibold text-ink">{overview.totalParticipants}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("Participantes asignados")}
            </p>
            <p className="text-2xl font-semibold text-ink">{overview.assignedParticipants}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("Por asignar")}
            </p>
            <p className="text-2xl font-semibold text-ink">{overview.unassignedParticipants}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("Hoteles")}
            </p>
            <p className="text-2xl font-semibold text-ink">{overview.hotelsCount}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("Habitaciones")}
            </p>
            <p className="text-2xl font-semibold text-ink">{overview.totalRooms}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("Camas")}
            </p>
            <p className="text-2xl font-semibold text-ink">{overview.totalBeds}</p>
          </div>
        </div>
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
