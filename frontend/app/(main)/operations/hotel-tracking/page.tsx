"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
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
  bedsCapacity?: number | null;
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

const pal = {
  cardBg: "#ffffff", cardBorder: "#e2e8f0", cardShadow: "0 1px 4px rgba(15,23,42,0.06)",
  textPrimary: "#0f172a", textMuted: "#64748b", labelColor: "#94a3b8",
  progressTrack: "#f1f5f9",
  kpi: ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#6366f1", "#14b8a6"],
};

const KPI_ICONS = [
  // Participantes
  <svg key="p" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  // Asignados
  <svg key="a" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  // Por asignar
  <svg key="pa" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  // Hoteles
  <svg key="h" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22V8l9-6 9 6v14"/><path d="M9 22V12h6v10"/><rect x="9" y="7" width="2" height="2"/><rect x="13" y="7" width="2" height="2"/></svg>,
  // Habitaciones
  <svg key="r" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
  // Camas
  <svg key="b" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>,
];

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
      setAthletes(filterValidatedAthletes(athleteData || []));
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
        const roomUsageList = Object.entries(roomUsage).map(([type, totalRooms]) => {
          const bedsForType = hotelRoomList
            .filter((r) => (r.roomType ?? "SIN_TIPO") === type)
            .reduce((s, r) => s + (r.bedsCapacity ?? 0), 0);
          return { type, total: totalRooms, beds: bedsForType };
        });
        const totalHotelBeds = hotelRoomList.reduce((s, r) => s + (r.bedsCapacity ?? 0), 0);
        return {
          ...hotel,
          assigned,
          available,
          occupancy,
          roomUsage: roomUsageList,
          totalHotelBeds,
          totalCapacity: total
        };
      })
      .sort((a, b) => (b.occupancy ?? 0) - (a.occupancy ?? 0));
  }, [hotels, athletes, selectedEventId, hotelRooms, hotelBeds, hotelAssignments]);

  const overview = useMemo(() => {
    const activeHotels = selectedEventId
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

    const totalParticipants = filteredAthletes.length;
    const assignedParticipants = filteredAssignments.filter((assignment) =>
      activeHotels.some((hotel) => hotel.id === assignment.hotelId)
    ).length;
    const totalRooms = activeHotels.reduce((sum, hotel) => {
      return sum + hotelRooms.filter((room) => room.hotelId === hotel.id).length;
    }, 0);
    const totalBeds = activeHotels.reduce((sum, hotel) => {
      const rooms = hotelRooms.filter((room) => room.hotelId === hotel.id);
      return sum + rooms.reduce((s, room) => s + (room.bedsCapacity ?? 0), 0);
    }, 0);
    const unassignedParticipants = Math.max(totalParticipants - assignedParticipants, 0);

    return { totalParticipants, assignedParticipants, unassignedParticipants, totalRooms, totalBeds, hotelsCount: activeHotels.length };
  }, [selectedEventId, hotels, athletes, hotelRooms, hotelAssignments]);

  const assignmentPct = overview.totalParticipants > 0
    ? Math.round((overview.assignedParticipants / overview.totalParticipants) * 100)
    : 0;
  const assignmentColor = assignmentPct >= 80 ? "#10b981" : assignmentPct >= 40 ? "#f59e0b" : "#ef4444";

  const kpiCards = [
    { label: "Participantes registrados", value: overview.totalParticipants, i: 0, sub: "Total en el evento" },
    { label: "Asignados a hotel",         value: overview.assignedParticipants, i: 1, sub: `${assignmentPct}% cubierto` },
    { label: "Por asignar",               value: overview.unassignedParticipants, i: 2, sub: overview.unassignedParticipants > 0 ? "Pendientes de alojamiento" : "Sin pendientes" },
    { label: "Hoteles activos",           value: overview.hotelsCount, i: 3, sub: "Propiedades en operación" },
    { label: "Habitaciones",              value: overview.totalRooms, i: 4, sub: "Total de cuartos" },
    { label: "Camas",                     value: overview.totalBeds, i: 5, sub: "Total de plazas" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Command panel */}
      <section style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "20px",
        padding: "24px 28px",
        boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#94a3b8" }}>Operaciones</p>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "99px", padding: "2px 8px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#10b981", letterSpacing: "0.08em" }}>EN VIVO</span>
              </span>
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", lineHeight: 1.2, marginBottom: "4px" }}>Tracking hotelería</h1>
            <p style={{ fontSize: "13px", color: "#64748b" }}>
              {lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString("es-CL")}` : "Disponibilidad en tiempo real"}
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>Evento</label>
              <select
                style={{ minWidth: "220px", height: "38px", padding: "0 12px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a", fontSize: "13px", fontWeight: 500, outline: "none" }}
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
              >
                <option value="">{t("Todos")}</option>
                {Object.values(events).map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>
                ))}
              </select>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              style={{
                background: "#ffffff", border: "1px solid #e2e8f0",
                borderRadius: "10px", padding: "9px 18px",
                color: loading ? "#94a3b8" : "#475569",
                fontSize: "13px", fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "7px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              {loading ? "Actualizando..." : "Refrescar"}
            </button>
          </div>
        </div>
        {error && <p style={{ marginTop: "10px", fontSize: "13px", color: "#ef4444" }}>{error}</p>}
      </section>

      {/* ── KPI cards */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>Resumen operativo</p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>Cobertura</span>
            <div style={{ width: "120px", height: "6px", borderRadius: "99px", background: "#f1f5f9", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${assignmentPct}%`, background: assignmentColor, borderRadius: "99px", transition: "width 400ms ease" }} />
            </div>
            <span style={{ fontSize: "13px", fontWeight: 800, color: assignmentColor }}>{assignmentPct}%</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpiCards.map((card) => {
            const color = card.i === 2 && overview.unassignedParticipants > 0 ? "#f59e0b" : pal.kpi[card.i];
            return (
              <article key={card.label} style={{
                background: pal.cardBg,
                border: `1px solid ${pal.cardBorder}`,
                borderTop: `3px solid ${color}`,
                borderRadius: "20px",
                padding: "18px 20px",
                boxShadow: pal.cardShadow,
                transition: "transform 120ms ease",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color, display: "flex" }}>{KPI_ICONS[card.i]}</span>
                    <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{card.label}</span>
                  </div>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                </div>
                <p style={{ fontSize: "2.4rem", fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {loading ? "—" : card.value}
                </p>
                <p style={{ marginTop: "6px", fontSize: "12px", color: pal.textMuted }}>{card.sub}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Hotel table */}
      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "24px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>Por propiedad</p>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>{t("Disponibilidad")}</h2>
        </div>
        {rows.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#94a3b8" }}>{t("Sin hoteles registrados.")}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  {[t("Hotel"), t("Evento"), t("Dirección"), t("Capacidad"), t("Ocupadas"), t("Disponibles"), t("Habitaciones"), t("Camas"), t("Ocupación")].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const eventName = row.eventId ? events[row.eventId]?.name : "-";
                  const occupancy = row.occupancy ?? 0;
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0f172a" }}>{row.name || row.id}</td>
                      <td style={{ padding: "10px 12px", color: "#64748b" }}>{eventName || row.eventId || "-"}</td>
                      <td style={{ padding: "10px 12px", color: "#64748b" }}>{row.address || "-"}</td>
                      <td style={{ padding: "10px 12px", color: "#64748b" }}>{row.totalCapacity ?? 0}</td>
                      <td style={{ padding: "10px 12px", color: "#64748b" }}>{row.assigned}</td>
                      <td style={{ padding: "10px 12px", color: "#64748b" }}>{row.available}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {row.roomUsage.length === 0 ? (
                          <span style={{ color: "#94a3b8" }}>-</span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            {row.roomUsage.map((room) => (
                              <div key={room.type} style={{ fontSize: "12px", color: "#64748b" }}>
                                {room.type}: {room.total}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {row.totalHotelBeds === 0 ? (
                          <span style={{ color: "#94a3b8" }}>-</span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{row.totalHotelBeds}</div>
                            {row.roomUsage.filter((r) => r.beds > 0).map((r) => (
                              <div key={r.type} style={{ fontSize: "12px", color: "#64748b" }}>{r.type}: {r.beds}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "80px", height: "6px", borderRadius: "99px", background: "#f1f5f9", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(occupancy, 100)}%`, background: "#21D0B3", borderRadius: "99px" }} />
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>{formatPercent(occupancy)}</span>
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
