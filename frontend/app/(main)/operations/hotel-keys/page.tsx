"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useTheme } from "@/lib/theme";

type HotelKeyStatus = "AVAILABLE" | "ASSIGNED" | "LOST" | "MAINTENANCE" | string;

type HotelKey = {
  id: string;
  hotelId: string;
  roomId: string;
  bedId?: string | null;
  keyNumber: string;
  copyNumber?: number | null;
  label?: string | null;
  status: HotelKeyStatus;
  holderName?: string | null;
  holderType?: string | null;
  holderParticipantId?: string | null;
  issuedAt?: string | null;
  returnedAt?: string | null;
  notes?: string | null;
  updatedAt?: string | null;
};

type HotelKeyMovement = {
  id: string;
  keyId: string;
  action: string;
  holderName?: string | null;
  holderType?: string | null;
  holderParticipantId?: string | null;
  actorName?: string | null;
  notes?: string | null;
  happenedAt?: string | null;
  createdAt?: string | null;
};

type EventItem = { id: string; name?: string | null };
type Accommodation = { id: string; eventId?: string | null; name?: string | null };
type HotelRoom = { id: string; hotelId?: string | null; roomNumber?: string | null };
type HotelBed = { id: string; roomId?: string | null; bedType?: string | null };
type Athlete = { id: string; fullName?: string | null };

type KeyForm = {
  hotelId: string;
  roomId: string;
  bedId: string;
  keyNumber: string;
  copyNumber: string;
  label: string;
  notes: string;
};

type IssueForm = {
  holderName: string;
  holderType: string;
  holderParticipantId: string;
  actorName: string;
  notes: string;
};

type ReturnForm = {
  actorName: string;
  notes: string;
};

const STATUS_STYLES: Record<string, { accent: string; chipBg: string; chipBorder: string; label: string; icon: string }> = {
  AVAILABLE:   { accent: "#10b981", chipBg: "rgba(16,185,129,0.13)", chipBorder: "rgba(16,185,129,0.32)", label: "Disponible",    icon: "✅" },
  ASSIGNED:    { accent: "#38bdf8", chipBg: "rgba(56,189,248,0.13)", chipBorder: "rgba(56,189,248,0.32)", label: "Entregada",     icon: "🔑" },
  MAINTENANCE: { accent: "#f59e0b", chipBg: "rgba(245,158,11,0.13)", chipBorder: "rgba(245,158,11,0.32)", label: "Mantenimiento", icon: "🔧" },
  LOST:        { accent: "#ef4444", chipBg: "rgba(239,68,68,0.11)",  chipBorder: "rgba(239,68,68,0.28)",  label: "Perdida",       icon: "⚠️" },
};
const getStatus = (s?: string | null) => STATUS_STYLES[s ?? ""] ?? { accent: "#94a3b8", chipBg: "rgba(148,163,184,0.1)", chipBorder: "rgba(148,163,184,0.25)", label: s || "-", icon: "🔘" };

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short"
  });
};

const emptyKeyForm = (): KeyForm => ({
  hotelId: "",
  roomId: "",
  bedId: "",
  keyNumber: "",
  copyNumber: "1",
  label: "",
  notes: ""
});

const emptyIssueForm = (): IssueForm => ({
  holderName: "",
  holderType: "",
  holderParticipantId: "",
  actorName: "",
  notes: ""
});

const emptyReturnForm = (): ReturnForm => ({
  actorName: "",
  notes: ""
});

export default function HotelKeysPage() {
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
    labelColor: "rgba(255,255,255,0.35)", textMuted: "rgba(255,255,255,0.5)",
    rowBg: "rgba(255,255,255,0.03)", rowHover: "rgba(255,255,255,0.06)",
    inputBg: "rgba(255,255,255,0.06)", inputColor: "#e2e8f0",
    kpi: ["#94a3b8", "#10b981", "#38bdf8", "#f59e0b", "#ef4444"],
  } : isDark ? {
    panelBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #111827 100%)",
    panelBorder: "rgba(255,255,255,0.06)", panelShadow: "0 4px 24px rgba(0,0,0,0.45)",
    orb1: "rgba(201,168,76,0.07)", orb2: "rgba(129,140,248,0.06)",
    accent: "#c9a84c", titleColor: "#f1f5f9", subtitleColor: "rgba(255,255,255,0.4)",
    cardBg: "var(--surface)", cardBorder: "var(--border)", cardShadow: "0 2px 12px rgba(0,0,0,0.3)",
    labelColor: "var(--text-faint)", textMuted: "var(--text-muted)",
    rowBg: "rgba(255,255,255,0.03)", rowHover: "rgba(255,255,255,0.05)",
    inputBg: "rgba(255,255,255,0.07)", inputColor: "#f1f5f9",
    kpi: ["#94a3b8", "#10b981", "#38bdf8", "#f59e0b", "#ef4444"],
  } : isAtlas ? {
    panelBg: "linear-gradient(135deg, #ffffff 0%, #f0f4ff 60%, #eef1f8 100%)",
    panelBorder: "#c7d2fe", panelShadow: "0 1px 4px rgba(0,0,0,0.07)",
    orb1: "rgba(59,91,219,0.06)", orb2: "rgba(100,129,240,0.05)",
    accent: "#3b5bdb", titleColor: "#0f172a", subtitleColor: "#64748b",
    cardBg: "#ffffff", cardBorder: "#e2e8f0", cardShadow: "0 1px 4px rgba(0,0,0,0.06)",
    labelColor: "#94a3b8", textMuted: "#64748b",
    rowBg: "#f8fafc", rowHover: "#f1f5f9",
    inputBg: "#ffffff", inputColor: "#0f172a",
    kpi: ["#64748b", "#10b981", "#3b82f6", "#f59e0b", "#ef4444"],
  } : {
    panelBg: "linear-gradient(135deg, #ffffff 0%, #f8fafc 60%, #f1f5f9 100%)",
    panelBorder: "#e2e8f0", panelShadow: "0 1px 4px rgba(0,0,0,0.06)",
    orb1: "rgba(30,58,138,0.04)", orb2: "rgba(124,58,237,0.04)",
    accent: "#1e3a8a", titleColor: "#0f172a", subtitleColor: "#64748b",
    cardBg: "#ffffff", cardBorder: "#e2e8f0", cardShadow: "0 1px 3px rgba(0,0,0,0.05)",
    labelColor: "#94a3b8", textMuted: "#64748b",
    rowBg: "#f8fafc", rowHover: "#f1f5f9",
    inputBg: "#ffffff", inputColor: "#0f172a",
    kpi: ["#64748b", "#10b981", "#3b82f6", "#f59e0b", "#ef4444"],
  };

  const [keys, setKeys] = useState<HotelKey[]>([]);
  const [movements, setMovements] = useState<HotelKeyMovement[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [hotels, setHotels] = useState<Accommodation[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [beds, setBeds] = useState<HotelBed[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyForm, setKeyForm] = useState<KeyForm>(emptyKeyForm);
  const [issueForm, setIssueForm] = useState<IssueForm>(emptyIssueForm);
  const [returnForm, setReturnForm] = useState<ReturnForm>(emptyReturnForm);
  const [issueKeyId, setIssueKeyId] = useState<string | null>(null);
  const [returnKeyId, setReturnKeyId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [keyData, movementData, eventData, hotelData, roomData, bedData, athleteData] = await Promise.all([
        apiFetch<HotelKey[]>("/hotel-keys"),
        apiFetch<HotelKeyMovement[]>("/hotel-keys/movements"),
        apiFetch<EventItem[]>("/events"),
        apiFetch<Accommodation[]>("/accommodations"),
        apiFetch<HotelRoom[]>("/hotel-rooms"),
        apiFetch<HotelBed[]>("/hotel-beds"),
        apiFetch<Athlete[]>("/athletes")
      ]);
      setKeys(keyData || []);
      setMovements(movementData || []);
      setEvents(eventData || []);
      setHotels(hotelData || []);
      setRooms(roomData || []);
      setBeds(bedData || []);
      setAthletes(filterValidatedAthletes(athleteData || []));

      if (!selectedEventId && (eventData || []).length > 0) {
        setSelectedEventId((eventData || [])[0].id);
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar gestión de llaves");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedKeyId) return;
    const loadOne = async () => {
      setLoadingMovements(true);
      try {
        const data = await apiFetch<HotelKeyMovement[]>(`/hotel-keys/${selectedKeyId}/movements`);
        setMovements(data || []);
      } catch {
        setMovements([]);
      } finally {
        setLoadingMovements(false);
      }
    };
    loadOne();
  }, [selectedKeyId]);

  const hotelById = useMemo(
    () =>
      hotels.reduce<Record<string, Accommodation>>((acc, hotel) => {
        acc[hotel.id] = hotel;
        return acc;
      }, {}),
    [hotels]
  );

  const roomById = useMemo(
    () =>
      rooms.reduce<Record<string, HotelRoom>>((acc, room) => {
        acc[room.id] = room;
        return acc;
      }, {}),
    [rooms]
  );

  const bedById = useMemo(
    () =>
      beds.reduce<Record<string, HotelBed>>((acc, bed) => {
        acc[bed.id] = bed;
        return acc;
      }, {}),
    [beds]
  );

  const athleteById = useMemo(
    () =>
      athletes.reduce<Record<string, Athlete>>((acc, athlete) => {
        acc[athlete.id] = athlete;
        return acc;
      }, {}),
    [athletes]
  );

  const filteredHotels = useMemo(
    () =>
      hotels.filter((hotel) => (selectedEventId ? hotel.eventId === selectedEventId : true)),
    [hotels, selectedEventId]
  );

  const filteredRooms = useMemo(
    () =>
      rooms.filter((room) => (keyForm.hotelId ? room.hotelId === keyForm.hotelId : true)),
    [rooms, keyForm.hotelId]
  );

  const filteredBeds = useMemo(
    () =>
      beds.filter((bed) => (keyForm.roomId ? bed.roomId === keyForm.roomId : true)),
    [beds, keyForm.roomId]
  );

  const enrichedKeys = useMemo(() => {
    const term = search.trim().toLowerCase();

    return keys
      .map((key) => {
        const room = roomById[key.roomId];
        const hotel = hotelById[key.hotelId];
        const bed = key.bedId ? bedById[key.bedId] : null;
        const holderAthlete = key.holderParticipantId
          ? athleteById[key.holderParticipantId]
          : null;
        return {
          ...key,
          hotelName: hotel?.name || key.hotelId,
          eventId: hotel?.eventId || "",
          roomNumber: room?.roomNumber || key.roomId,
          bedLabel: bed?.bedType || (key.bedId ? key.bedId : "-"),
          holderText:
            holderAthlete?.fullName ||
            key.holderName ||
            (key.status === "ASSIGNED" ? "Asignada" : "Sin asignar")
        };
      })
      .filter((key) => (selectedEventId ? key.eventId === selectedEventId : true))
      .filter((key) => (selectedHotelId ? key.hotelId === selectedHotelId : true))
      .filter((key) => (selectedStatus ? key.status === selectedStatus : true))
      .filter((key) => {
        if (!term) return true;
        return [
          key.keyNumber,
          key.label,
          key.hotelName,
          key.roomNumber,
          key.holderText
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const score = (status: string) =>
          status === "ASSIGNED" ? 0 : status === "AVAILABLE" ? 1 : status === "MAINTENANCE" ? 2 : 3;
        const statusCompare = score(a.status) - score(b.status);
        if (statusCompare !== 0) return statusCompare;
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
  }, [keys, roomById, hotelById, bedById, athleteById, selectedEventId, selectedHotelId, selectedStatus, search]);

  const selectedKey = useMemo(
    () => enrichedKeys.find((item) => item.id === selectedKeyId) || null,
    [enrichedKeys, selectedKeyId]
  );

  const selectedMovements = useMemo(() => {
    if (!selectedKeyId) return [];
    return movements.filter((movement) => movement.keyId === selectedKeyId);
  }, [movements, selectedKeyId]);

  const stats = useMemo(() => {
    const total = enrichedKeys.length;
    const available = enrichedKeys.filter((item) => item.status === "AVAILABLE").length;
    const assigned = enrichedKeys.filter((item) => item.status === "ASSIGNED").length;
    const maintenance = enrichedKeys.filter((item) => item.status === "MAINTENANCE").length;
    const lost = enrichedKeys.filter((item) => item.status === "LOST").length;
    return { total, available, assigned, maintenance, lost };
  }, [enrichedKeys]);

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/hotel-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: keyForm.hotelId,
          roomId: keyForm.roomId,
          bedId: keyForm.bedId || null,
          keyNumber: keyForm.keyNumber,
          copyNumber: Number(keyForm.copyNumber || "1"),
          label: keyForm.label || null,
          notes: keyForm.notes || null
        })
      });
      setKeyForm(emptyKeyForm());
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la llave");
    }
  };

  const submitIssue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!issueKeyId) return;
    setError(null);
    try {
      await apiFetch(`/hotel-keys/${issueKeyId}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holderName: issueForm.holderName,
          holderType: issueForm.holderType || null,
          holderParticipantId: issueForm.holderParticipantId || null,
          actorName: issueForm.actorName || null,
          notes: issueForm.notes || null
        })
      });
      setIssueForm(emptyIssueForm());
      setIssueKeyId(null);
      await loadData();
      setSelectedKeyId(issueKeyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entregar la llave");
    }
  };

  const submitReturn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!returnKeyId) return;
    setError(null);
    try {
      await apiFetch(`/hotel-keys/${returnKeyId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorName: returnForm.actorName || null,
          notes: returnForm.notes || null
        })
      });
      setReturnForm(emptyReturnForm());
      setReturnKeyId(null);
      await loadData();
      setSelectedKeyId(returnKeyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la devolución");
    }
  };

  const changeStatus = async (keyId: string, status: HotelKeyStatus) => {
    setError(null);
    try {
      await apiFetch(`/hotel-keys/${keyId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          actorName: "Operaciones Hotelería"
        })
      });
      await loadData();
      setSelectedKeyId(keyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar estado");
    }
  };

  const assignedPct = stats.total > 0 ? Math.round((stats.assigned / stats.total) * 100) : 0;

  const kpiCards = [
    { label: "Total llaves", value: stats.total,       icon: "🗝️", color: pal.kpi[0], sub: "En inventario" },
    { label: "Disponibles",  value: stats.available,   icon: "✅", color: pal.kpi[1], sub: "Listas para entrega" },
    { label: "Entregadas",   value: stats.assigned,    icon: "🔑", color: pal.kpi[2], sub: `${assignedPct}% del total` },
    { label: "Mantenimiento",value: stats.maintenance, icon: "🔧", color: pal.kpi[3], sub: "Fuera de servicio" },
    { label: "Perdidas",     value: stats.lost,        icon: "⚠️", color: pal.kpi[4], sub: stats.lost > 0 ? "¡Requiere atención!" : "Sin incidencias" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Command panel */}
      <section style={{
        background: pal.panelBg, border: `1px solid ${pal.panelBorder}`,
        borderRadius: "20px", padding: "24px 28px", boxShadow: pal.panelShadow,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "-40px", right: "8%", width: "200px", height: "200px", borderRadius: "50%", background: pal.orb1, filter: "blur(50px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-30px", left: "15%", width: "150px", height: "150px", borderRadius: "50%", background: pal.orb2, filter: "blur(40px)", pointerEvents: "none" }} />

        <div className="flex flex-wrap items-start justify-between gap-5" style={{ position: "relative" }}>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.accent }}>Operaciones</p>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.28)", borderRadius: "99px", padding: "2px 8px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite", display: "inline-block" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#10b981", letterSpacing: "0.08em" }}>EN VIVO</span>
              </span>
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: pal.titleColor, lineHeight: 1.2, marginBottom: "4px" }}>Gestión de llaves</h1>
            <p style={{ fontSize: "13px", color: pal.subtitleColor }}>
              {lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString("es-CL")}` : "Control operativo en tiempo real"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select className="input h-10 rounded-2xl" style={{ minWidth: "180px", background: pal.inputBg, color: pal.inputColor }}
              value={selectedEventId} onChange={(e) => { setSelectedEventId(e.target.value); setSelectedHotelId(""); }}>
              <option value="">Todos los eventos</option>
              {events.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
            </select>
            <select className="input h-10 rounded-2xl" style={{ minWidth: "160px", background: pal.inputBg, color: pal.inputColor }}
              value={selectedHotelId} onChange={(e) => setSelectedHotelId(e.target.value)}>
              <option value="">Todos los hoteles</option>
              {filteredHotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name || hotel.id}</option>)}
            </select>
            <select className="input h-10 rounded-2xl" style={{ minWidth: "150px", background: pal.inputBg, color: pal.inputColor }}
              value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="AVAILABLE">Disponible</option>
              <option value="ASSIGNED">Entregada</option>
              <option value="MAINTENANCE">Mantenimiento</option>
              <option value="LOST">Perdida</option>
            </select>
            <input className="input h-10 rounded-2xl" style={{ minWidth: "220px", background: pal.inputBg, color: pal.inputColor }}
              placeholder="Buscar llave, habitación, hotel…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <button onClick={loadData} disabled={loading} style={{
              background: "transparent", border: `1px solid ${pal.panelBorder}`,
              borderRadius: "10px", padding: "9px 16px", color: pal.subtitleColor,
              fontSize: "13px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <span>↻</span>{loading ? "Actualizando..." : "Refrescar"}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
      </section>

      {/* ── KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => (
          <article key={card.label} style={{
            background: pal.cardBg, border: `1px solid ${pal.cardBorder}`,
            borderTop: `3px solid ${card.color}`, borderRadius: "20px",
            padding: "18px 20px", boxShadow: pal.cardShadow,
            transition: "transform 120ms ease",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span style={{ fontSize: "16px" }}>{card.icon}</span>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: pal.labelColor }}>{card.label}</span>
              </div>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: card.color, boxShadow: `0 0 6px ${card.color}88`, display: "inline-block" }} />
            </div>
            <p style={{
              fontSize: "2.4rem", fontWeight: 800, color: card.color, lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              ...(isObsidian ? { textShadow: `0 0 20px ${card.color}55` } : {}),
            }}>
              {loading ? "—" : card.value}
            </p>
            <p style={{ marginTop: "6px", fontSize: "12px", color: pal.textMuted }}>{card.sub}</p>
          </article>
        ))}
      </section>

      {/* ── Main grid */}
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">

        {/* Inventory list */}
        <article style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderRadius: "24px", padding: "22px", boxShadow: pal.cardShadow }}>
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: pal.labelColor }}>Control de inventario</p>
            <h3 style={{ marginTop: "3px", fontWeight: 700, fontSize: "16px", color: pal.titleColor }}>Inventario de llaves</h3>
            <p style={{ marginTop: "3px", fontSize: "13px", color: pal.textMuted }}>Selecciona una llave para ver su bitácora y operar entrega/devolución.</p>
          </div>
          <div className="space-y-3">
            {enrichedKeys.length === 0 ? (
              <div style={{ borderRadius: "16px", border: `1px dashed ${pal.cardBorder}`, background: pal.rowBg, padding: "48px 24px", textAlign: "center" as const, color: pal.textMuted, fontSize: "14px" }}>
                Sin llaves registradas para este filtro.
              </div>
            ) : (
              enrichedKeys.map((key) => {
                const ss = getStatus(key.status);
                const isSelected = selectedKeyId === key.id;
                return (
                  <div key={key.id} style={{
                    background: isSelected ? `${ss.accent}0d` : pal.rowBg,
                    border: `1px solid ${isSelected ? ss.accent + "55" : pal.cardBorder}`,
                    borderLeft: `4px solid ${ss.accent}`,
                    borderRadius: "16px", padding: "14px 16px",
                    transition: "all 120ms ease",
                  }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" as const, marginBottom: "8px" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: "5px",
                            background: ss.chipBg, border: `1px solid ${ss.chipBorder}`,
                            borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700, color: ss.accent,
                          }}>
                            {ss.icon} {ss.label}
                          </span>
                          <button type="button" onClick={() => setSelectedKeyId(key.id)}
                            style={{ fontSize: "12px", fontWeight: 600, color: pal.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            Ver bitácora →
                          </button>
                        </div>
                        <h4 style={{ fontWeight: 800, fontSize: "20px", color: pal.titleColor, marginBottom: "4px" }}>
                          🔑 {key.keyNumber} · Copia {key.copyNumber || 1}
                        </h4>
                        <p style={{ fontSize: "13px", color: pal.textMuted }}>
                          {key.hotelName} · Hab. {key.roomNumber} · Cama {key.bedLabel}
                        </p>
                        <p style={{ marginTop: "4px", fontSize: "13px", color: pal.textMuted }}>
                          Responsable: <span style={{ fontWeight: 700, color: pal.titleColor }}>{key.holderText}</span>
                        </p>
                        <p style={{ marginTop: "3px", fontSize: "11px", color: pal.labelColor }}>
                          Entrega: {formatDateTime(key.issuedAt)} · Dev.: {formatDateTime(key.returnedAt)}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "6px", alignItems: "flex-start" }}>
                        {key.status !== "ASSIGNED" && (
                          <button type="button" onClick={() => { setIssueKeyId(key.id); setIssueForm((p) => ({ ...p, holderName: key.holderName || "", holderType: key.holderType || "" })); setReturnKeyId(null); setSelectedKeyId(key.id); }}
                            style={{ background: "rgba(56,189,248,0.13)", border: "1px solid rgba(56,189,248,0.32)", borderRadius: "99px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, color: "#38bdf8", cursor: "pointer" }}>
                            Entregar
                          </button>
                        )}
                        {key.status === "ASSIGNED" && (
                          <button type="button" onClick={() => { setReturnKeyId(key.id); setIssueKeyId(null); setSelectedKeyId(key.id); }}
                            style={{ background: "rgba(16,185,129,0.13)", border: "1px solid rgba(16,185,129,0.32)", borderRadius: "99px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, color: "#10b981", cursor: "pointer" }}>
                            Registrar devolución
                          </button>
                        )}
                        <button type="button" onClick={() => changeStatus(key.id, "MAINTENANCE")}
                          style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.28)", borderRadius: "99px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "#f59e0b", cursor: "pointer" }}>
                          🔧
                        </button>
                        <button type="button" onClick={() => changeStatus(key.id, "LOST")}
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "99px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "#ef4444", cursor: "pointer" }}>
                          ⚠️
                        </button>
                        {key.status !== "AVAILABLE" && (
                          <button type="button" onClick={() => changeStatus(key.id, "AVAILABLE")}
                            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.28)", borderRadius: "99px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "#10b981", cursor: "pointer" }}>
                            ✅
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Alta de llave */}
          <article style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderTop: `3px solid ${pal.accent}`, borderRadius: "24px", padding: "20px", boxShadow: pal.cardShadow }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: pal.labelColor, marginBottom: "4px" }}>Registrar</p>
            <h3 style={{ fontWeight: 700, fontSize: "16px", color: pal.titleColor, marginBottom: "14px" }}>Alta de llave</h3>
            <form className="space-y-3" onSubmit={submitCreate}>
              <select className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} value={keyForm.hotelId}
                onChange={(e) => setKeyForm((p) => ({ ...p, hotelId: e.target.value, roomId: "", bedId: "" }))} required>
                <option value="">Selecciona hotel</option>
                {filteredHotels.map((h) => <option key={h.id} value={h.id}>{h.name || h.id}</option>)}
              </select>
              <select className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} value={keyForm.roomId}
                onChange={(e) => setKeyForm((p) => ({ ...p, roomId: e.target.value, bedId: "" }))} required>
                <option value="">Selecciona habitación</option>
                {filteredRooms.map((r) => <option key={r.id} value={r.id}>Habitación {r.roomNumber || r.id}</option>)}
              </select>
              <select className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} value={keyForm.bedId}
                onChange={(e) => setKeyForm((p) => ({ ...p, bedId: e.target.value }))}>
                <option value="">Sin cama asociada</option>
                {filteredBeds.map((b) => <option key={b.id} value={b.id}>{b.bedType || "Cama"} · {b.id.slice(0, 8)}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} placeholder="Número llave" value={keyForm.keyNumber}
                  onChange={(e) => setKeyForm((p) => ({ ...p, keyNumber: e.target.value }))} required />
                <input className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} placeholder="N° copia" type="number" min={1} value={keyForm.copyNumber}
                  onChange={(e) => setKeyForm((p) => ({ ...p, copyNumber: e.target.value }))} required />
              </div>
              <input className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} placeholder="Etiqueta opcional" value={keyForm.label}
                onChange={(e) => setKeyForm((p) => ({ ...p, label: e.target.value }))} />
              <textarea className="input min-h-[80px] rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} placeholder="Notas de inventario" value={keyForm.notes}
                onChange={(e) => setKeyForm((p) => ({ ...p, notes: e.target.value }))} />
              <button className="btn btn-primary w-full justify-center" type="submit">Registrar llave</button>
            </form>
          </article>

          {/* Entrega */}
          {issueKeyId && (
            <article style={{ background: pal.cardBg, border: `1px solid rgba(56,189,248,0.35)`, borderTop: "3px solid #38bdf8", borderRadius: "24px", padding: "20px", boxShadow: pal.cardShadow }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: "#38bdf8", marginBottom: "4px" }}>Operación</p>
              <h3 style={{ fontWeight: 700, fontSize: "16px", color: pal.titleColor, marginBottom: "14px" }}>🔑 Entrega de llave</h3>
              <form className="space-y-3" onSubmit={submitIssue}>
                <select className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} value={issueForm.holderParticipantId}
                  onChange={(e) => { const a = athleteById[e.target.value]; setIssueForm((p) => ({ ...p, holderParticipantId: e.target.value, holderName: a?.fullName || p.holderName })); }}>
                  <option value="">Seleccionar participante (opcional)</option>
                  {athletes.map((a) => <option key={a.id} value={a.id}>{a.fullName || a.id}</option>)}
                </select>
                <input className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} placeholder="Nombre de quien recibe" value={issueForm.holderName}
                  onChange={(e) => setIssueForm((p) => ({ ...p, holderName: e.target.value }))} required />
                <input className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} placeholder="Rol / tipo (atleta, staff…)" value={issueForm.holderType}
                  onChange={(e) => setIssueForm((p) => ({ ...p, holderType: e.target.value }))} />
                <input className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} placeholder="Operador que entrega" value={issueForm.actorName}
                  onChange={(e) => setIssueForm((p) => ({ ...p, actorName: e.target.value }))} />
                <textarea className="input min-h-[70px] rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} placeholder="Observaciones" value={issueForm.notes}
                  onChange={(e) => setIssueForm((p) => ({ ...p, notes: e.target.value }))} />
                <div className="flex gap-2">
                  <button className="btn btn-primary flex-1 justify-center" type="submit">Confirmar entrega</button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setIssueKeyId(null); setIssueForm(emptyIssueForm()); }}>Cancelar</button>
                </div>
              </form>
            </article>
          )}

          {/* Devolución */}
          {returnKeyId && (
            <article style={{ background: pal.cardBg, border: `1px solid rgba(16,185,129,0.35)`, borderTop: "3px solid #10b981", borderRadius: "24px", padding: "20px", boxShadow: pal.cardShadow }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: "#10b981", marginBottom: "4px" }}>Operación</p>
              <h3 style={{ fontWeight: 700, fontSize: "16px", color: pal.titleColor, marginBottom: "14px" }}>✅ Devolución de llave</h3>
              <form className="space-y-3" onSubmit={submitReturn}>
                <input className="input rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} placeholder="Operador que recibe" value={returnForm.actorName}
                  onChange={(e) => setReturnForm((p) => ({ ...p, actorName: e.target.value }))} />
                <textarea className="input min-h-[70px] rounded-2xl" style={{ background: pal.inputBg, color: pal.inputColor }} placeholder="Observaciones de devolución" value={returnForm.notes}
                  onChange={(e) => setReturnForm((p) => ({ ...p, notes: e.target.value }))} />
                <div className="flex gap-2">
                  <button className="btn btn-primary flex-1 justify-center" type="submit">Confirmar devolución</button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setReturnKeyId(null); setReturnForm(emptyReturnForm()); }}>Cancelar</button>
                </div>
              </form>
            </article>
          )}

          {/* Bitácora */}
          <article style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderRadius: "24px", padding: "20px", boxShadow: pal.cardShadow }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: pal.labelColor, marginBottom: "4px" }}>Historial</p>
            <h3 style={{ fontWeight: 700, fontSize: "16px", color: pal.titleColor, marginBottom: "12px" }}>Bitácora de movimientos</h3>
            {!selectedKey ? (
              <p style={{ fontSize: "13px", color: pal.textMuted }}>Selecciona una llave para ver su historial.</p>
            ) : (
              <>
                <p style={{ fontSize: "13px", color: pal.textMuted, marginBottom: "12px" }}>
                  Llave <span style={{ fontWeight: 700, color: pal.titleColor }}>{selectedKey.keyNumber}</span> · Hab. <span style={{ fontWeight: 700, color: pal.titleColor }}>{selectedKey.roomNumber}</span>
                </p>
                <div style={{ maxHeight: "360px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {loadingMovements ? (
                    <p style={{ fontSize: "13px", color: pal.textMuted }}>Cargando movimientos...</p>
                  ) : selectedMovements.length === 0 ? (
                    <p style={{ fontSize: "13px", color: pal.textMuted }}>Sin movimientos registrados.</p>
                  ) : (
                    selectedMovements.map((mv) => {
                      const action = mv.action || "";
                      const actionColor = action.includes("ISSUE") ? "#38bdf8" : action.includes("RETURN") ? "#10b981" : action.includes("LOST") ? "#ef4444" : pal.labelColor;
                      return (
                        <div key={mv.id} style={{
                          background: pal.rowBg, border: `1px solid ${pal.cardBorder}`,
                          borderLeft: `3px solid ${actionColor}`, borderRadius: "12px", padding: "10px 12px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: actionColor }}>{mv.action}</span>
                            <span style={{ fontSize: "11px", color: pal.labelColor }}>{formatDateTime(mv.happenedAt || mv.createdAt)}</span>
                          </div>
                          <p style={{ marginTop: "4px", fontSize: "13px", fontWeight: 600, color: pal.titleColor }}>
                            {mv.holderName || mv.actorName || "Sin responsable informado"}
                          </p>
                          {mv.notes && <p style={{ marginTop: "3px", fontSize: "11px", color: pal.textMuted }}>{mv.notes}</p>}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}


