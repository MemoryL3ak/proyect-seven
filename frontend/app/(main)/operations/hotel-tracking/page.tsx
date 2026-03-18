"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

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

export default function HotelTrackingPage() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const isObsidian = theme === "obsidian";
  const isAtlas = theme === "atlas";
  const isDark = theme === "dark";

  const pal = isObsidian ? {
    panelBg: "linear-gradient(135deg, #0a1322 0%, #0e1728 60%, #0d1a30 100%)",
    panelBorder: "rgba(34,211,238,0.08)", panelShadow: "0 4px 32px rgba(0,0,0,0.6)",
    orb1: "rgba(34,211,238,0.07)", orb2: "rgba(168,85,247,0.06)",
    accent: "#22d3ee", titleColor: "#e2e8f0", subtitleColor: "rgba(255,255,255,0.45)",
    cardBg: "#0e1728", cardBorder: "rgba(34,211,238,0.1)", cardShadow: "0 4px 20px rgba(0,0,0,0.5)",
    labelColor: "rgba(255,255,255,0.35)", textMuted: "rgba(255,255,255,0.45)",
    inputBg: "rgba(255,255,255,0.05)", btnBorder: "rgba(255,255,255,0.15)", btnColor: "rgba(255,255,255,0.8)",
    progressTrack: "rgba(255,255,255,0.08)",
    kpi: ["#38bdf8", "#10b981", "#f59e0b", "#a855f7", "#6366f1", "#14b8a6"],
  } : isDark ? {
    panelBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #111827 100%)",
    panelBorder: "rgba(255,255,255,0.06)", panelShadow: "0 4px 24px rgba(0,0,0,0.45)",
    orb1: "rgba(201,168,76,0.07)", orb2: "rgba(129,140,248,0.06)",
    accent: "#c9a84c", titleColor: "#f1f5f9", subtitleColor: "rgba(255,255,255,0.4)",
    cardBg: "var(--surface)", cardBorder: "var(--border)", cardShadow: "0 2px 12px rgba(0,0,0,0.3)",
    labelColor: "var(--text-faint)", textMuted: "var(--text-muted)",
    inputBg: "rgba(255,255,255,0.04)", btnBorder: "rgba(255,255,255,0.12)", btnColor: "rgba(255,255,255,0.75)",
    progressTrack: "rgba(255,255,255,0.07)",
    kpi: ["#38bdf8", "#10b981", "#f59e0b", "#a855f7", "#818cf8", "#14b8a6"],
  } : isAtlas ? {
    panelBg: "linear-gradient(135deg, #ffffff 0%, #f0f4ff 60%, #eef1f8 100%)",
    panelBorder: "#c7d2fe", panelShadow: "0 1px 4px rgba(0,0,0,0.07)",
    orb1: "rgba(59,91,219,0.06)", orb2: "rgba(100,129,240,0.05)",
    accent: "#3b5bdb", titleColor: "#0f172a", subtitleColor: "#64748b",
    cardBg: "#ffffff", cardBorder: "#e2e8f0", cardShadow: "0 1px 4px rgba(0,0,0,0.06)",
    labelColor: "#94a3b8", textMuted: "#64748b",
    inputBg: "#ffffff", btnBorder: "#c7d2fe", btnColor: "#3b5bdb",
    progressTrack: "#e2e8f0",
    kpi: ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#6366f1", "#14b8a6"],
  } : {
    panelBg: "linear-gradient(135deg, #ffffff 0%, #f8fafc 60%, #f1f5f9 100%)",
    panelBorder: "#e2e8f0", panelShadow: "0 1px 4px rgba(0,0,0,0.06)",
    orb1: "rgba(30,58,138,0.04)", orb2: "rgba(124,58,237,0.04)",
    accent: "#1e3a8a", titleColor: "#0f172a", subtitleColor: "#64748b",
    cardBg: "#ffffff", cardBorder: "#e2e8f0", cardShadow: "0 1px 3px rgba(0,0,0,0.05)",
    labelColor: "#94a3b8", textMuted: "#64748b",
    inputBg: "#ffffff", btnBorder: "#e2e8f0", btnColor: "#374151",
    progressTrack: "#f1f5f9",
    kpi: ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#6366f1", "#14b8a6"],
  };
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
      const rooms = hotelRooms.filter((room) => room.hotelId === hotel.id).length;
      return sum + rooms;
    }, 0);

    const totalBeds = activeHotels.reduce((sum, hotel) => {
      const rooms = hotelRooms.filter((room) => room.hotelId === hotel.id);
      return sum + rooms.reduce((s, room) => s + (room.bedsCapacity ?? 0), 0);
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
  }, [selectedEventId, hotels, athletes, hotelRooms, hotelAssignments]);

  const assignmentPct = overview.totalParticipants > 0
    ? Math.round((overview.assignedParticipants / overview.totalParticipants) * 100)
    : 0;
  const assignmentColor = assignmentPct >= 80 ? "#10b981" : assignmentPct >= 40 ? "#f59e0b" : "#ef4444";

  const kpiCards = [
    { label: "Participantes registrados", value: overview.totalParticipants, icon: "👥", i: 0, sub: "Total en el evento" },
    { label: "Asignados a hotel", value: overview.assignedParticipants, icon: "✅", i: 1, sub: `${assignmentPct}% cubierto` },
    { label: "Por asignar", value: overview.unassignedParticipants, icon: "⏳", i: 2, sub: overview.unassignedParticipants > 0 ? "Pendientes de alojamiento" : "Sin pendientes" },
    { label: "Hoteles activos", value: overview.hotelsCount, icon: "🏨", i: 3, sub: "Propiedades en operación" },
    { label: "Habitaciones", value: overview.totalRooms, icon: "🚪", i: 4, sub: "Total de cuartos" },
    { label: "Camas", value: overview.totalBeds, icon: "🛏", i: 5, sub: "Total de plazas" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Command panel */}
      <section style={{
        background: pal.panelBg,
        border: `1px solid ${pal.panelBorder}`,
        borderRadius: "20px",
        padding: "24px 28px",
        boxShadow: pal.panelShadow,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "-40px", right: "8%", width: "200px", height: "200px", borderRadius: "50%", background: pal.orb1, filter: "blur(50px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-30px", left: "15%", width: "150px", height: "150px", borderRadius: "50%", background: pal.orb2, filter: "blur(40px)", pointerEvents: "none" }} />

        <div className="flex flex-wrap items-start justify-between gap-4" style={{ position: "relative" }}>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.accent }}>Operaciones</p>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.28)", borderRadius: "99px", padding: "2px 8px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite", display: "inline-block" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#10b981", letterSpacing: "0.08em" }}>EN VIVO</span>
              </span>
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: pal.titleColor, lineHeight: 1.2, marginBottom: "4px" }}>Tracking hotelería</h1>
            <p style={{ fontSize: "13px", color: pal.subtitleColor }}>
              {lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString("es-CL")}` : "Disponibilidad en tiempo real"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.subtitleColor }}>Evento</label>
              <select
                className="input h-10 leading-5"
                style={{ minWidth: "260px", background: pal.inputBg, color: pal.titleColor }}
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
                background: "transparent", border: `1px solid ${pal.btnBorder}`,
                borderRadius: "10px", padding: "9px 18px",
                color: loading ? pal.subtitleColor : pal.btnColor,
                fontSize: "13px", fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "7px",
              }}
            >
              <span style={{ fontSize: "14px" }}>↻</span>
              {loading ? "Actualizando..." : "Refrescar"}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
      </section>

      {/* ── KPI cards */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.labelColor }}>Resumen operativo</p>
            <h2 style={{ marginTop: "3px", fontWeight: 700, fontSize: "16px", color: pal.titleColor }}>Overview de alojamiento</h2>
          </div>
          {/* Assignment progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: pal.textMuted }}>Cobertura</span>
            <div style={{ width: "120px", height: "6px", borderRadius: "99px", background: pal.progressTrack, overflow: "hidden" }}>
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
                    <span style={{ fontSize: "18px" }}>{card.icon}</span>
                    <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{card.label}</span>
                  </div>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}88`, display: "inline-block", flexShrink: 0 }} />
                </div>
                <p style={{
                  fontSize: "2.4rem", fontWeight: 800, color, lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                  ...(isObsidian ? { textShadow: `0 0 20px ${color}55` } : {}),
                }}>
                  {loading ? "—" : card.value}
                </p>
                <p style={{ marginTop: "6px", fontSize: "12px", color: pal.textMuted }}>{card.sub}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="surface rounded-2xl p-6">
        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.labelColor }}>Por propiedad</p>
          <h2 className="font-sans font-bold text-lg mt-1" style={{ color: "var(--text)" }}>{t("Disponibilidad")}</h2>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("Sin hoteles registrados.")}</p>
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
                          <div className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
                            {row.roomUsage.map((room) => (
                              <div key={room.type}>
                                {room.type}: {room.total}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {row.totalHotelBeds === 0 ? (
                          "-"
                        ) : (
                          <div className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
                            <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "13px" }}>{row.totalHotelBeds}</div>
                            {row.roomUsage.filter((r) => r.beds > 0).map((r) => (
                              <div key={r.type}>{r.type}: {r.beds}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                            <div
                              className="h-full"
                              style={{ width: `${Math.min(occupancy, 100)}%`, background: "var(--success)" }}
                            />
                          </div>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatPercent(occupancy)}</span>
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


