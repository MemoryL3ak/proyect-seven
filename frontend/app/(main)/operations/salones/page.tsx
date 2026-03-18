"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/lib/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

type Salon = {
  id: string;
  hotelId: string;
  name: string;
  type: string;
  capacity: number;
  status: string;
  floor?: string | null;
  notes?: string | null;
};

type Reservation = {
  id: string;
  salonId: string;
  title: string;
  organizerName?: string | null;
  organizerEmail?: string | null;
  eventId?: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  attendees?: number | null;
  status: string;
  notes?: string | null;
};

type Hotel = { id: string; name?: string | null };

// ── Constants ─────────────────────────────────────────────────────────────────

const SALON_TYPES = [
  { value: "SALA_REUNION", label: "Sala de reunión" },
  { value: "AUDITORIO", label: "Auditorio" },
  { value: "SALON_EVENTOS", label: "Salón de eventos" },
  { value: "COMEDOR", label: "Comedor" },
  { value: "SALA_PRENSA", label: "Sala de prensa" },
  { value: "OTRO", label: "Otro" },
];

const SALON_TYPE_ICON: Record<string, string> = {
  SALA_REUNION: "🤝", AUDITORIO: "🎤", SALON_EVENTOS: "🎪",
  COMEDOR: "🍽️", SALA_PRENSA: "📰", OTRO: "🏛️",
};

const SALON_STATUS = [
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "MAINTENANCE", label: "Mantenimiento" },
];

const RES_STATUS = [
  { value: "CONFIRMED", label: "Confirmada" },
  { value: "PENDING", label: "Pendiente" },
  { value: "CANCELLED", label: "Cancelada" },
];

const RES_STATUS_COLOR: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  CONFIRMED: { bg: "rgba(16,185,129,0.12)", text: "#10b981", border: "rgba(16,185,129,0.3)", dot: "#10b981" },
  PENDING:   { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", border: "rgba(245,158,11,0.3)", dot: "#f59e0b" },
  CANCELLED: { bg: "rgba(239,68,68,0.12)",  text: "#ef4444", border: "rgba(239,68,68,0.3)",  dot: "#ef4444" },
};

// Calendar hours: 07:00 → 23:00
const HOUR_START = 7;
const HOUR_END = 23;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const HOUR_HEIGHT = 64; // px per hour

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(t: string): string {
  const [h, m] = t.split(":");
  return `${h}:${m}`;
}

function isoToDisplay(d: string): string {
  const [y, mo, day] = d.split("-");
  return `${day}/${mo}/${y}`;
}

// ── Empty forms ───────────────────────────────────────────────────────────────

const emptySalonForm = () => ({
  hotelId: "", name: "", type: "SALA_REUNION",
  capacity: "", status: "ACTIVE", floor: "", notes: "",
});

const emptyResForm = (salonId = "", date = "") => ({
  salonId, title: "", organizerName: "", organizerEmail: "",
  startDate: date, endDate: date,
  startTime: "09:00", endTime: "11:00",
  attendees: "", status: "CONFIRMED", notes: "",
});

// ── Main component ─────────────────────────────────────────────────────────────

export default function SalonesPage() {
  const { theme } = useTheme();
  const isObsidian = theme === "obsidian";
  const isAtlas = theme === "atlas";
  const isDark = theme === "dark";

  // ── Palette ─────────────────────────────────────────────────────────────────
  const pal = isObsidian ? {
    bg: "#080f1e", panelBg: "#0e1728", panelBorder: "rgba(34,211,238,0.1)",
    cardBg: "#0a1322", cardBorder: "rgba(34,211,238,0.1)", shadow: "0 4px 24px rgba(0,0,0,0.55)",
    accent: "#22d3ee", accent2: "#a855f7",
    text: "#e2e8f0", textMuted: "rgba(255,255,255,0.45)", textFaint: "rgba(255,255,255,0.25)",
    gridLine: "rgba(255,255,255,0.05)", gridLineHour: "rgba(255,255,255,0.08)",
    today: "rgba(34,211,238,0.06)", inputBg: "rgba(255,255,255,0.05)",
    calHeader: "#0e1728", headerBorder: "rgba(34,211,238,0.1)",
  } : isDark ? {
    bg: "var(--bg)", panelBg: "var(--surface)", panelBorder: "var(--border)",
    cardBg: "var(--elevated)", cardBorder: "var(--border-muted)", shadow: "0 2px 12px rgba(0,0,0,0.3)",
    accent: "#c9a84c", accent2: "#818cf8",
    text: "var(--text)", textMuted: "var(--text-muted)", textFaint: "var(--text-faint)",
    gridLine: "rgba(255,255,255,0.04)", gridLineHour: "rgba(255,255,255,0.07)",
    today: "rgba(201,168,76,0.05)", inputBg: "rgba(255,255,255,0.04)",
    calHeader: "var(--surface)", headerBorder: "var(--border)",
  } : isAtlas ? {
    bg: "#f0f4ff", panelBg: "#ffffff", panelBorder: "#c7d2fe",
    cardBg: "#ffffff", cardBorder: "#e2e8f0", shadow: "0 1px 4px rgba(0,0,0,0.07)",
    accent: "#3b5bdb", accent2: "#7c3aed",
    text: "#0f172a", textMuted: "#64748b", textFaint: "#94a3b8",
    gridLine: "#f1f5f9", gridLineHour: "#e2e8f0",
    today: "rgba(59,91,219,0.04)", inputBg: "#f8fafc",
    calHeader: "#f8fafc", headerBorder: "#e2e8f0",
  } : {
    bg: "#f8fafc", panelBg: "#ffffff", panelBorder: "#e2e8f0",
    cardBg: "#ffffff", cardBorder: "#e8edf5", shadow: "0 1px 4px rgba(0,0,0,0.07)",
    accent: "#1e3a8a", accent2: "#7c3aed",
    text: "#0f172a", textMuted: "#64748b", textFaint: "#94a3b8",
    gridLine: "#f8fafc", gridLineHour: "#f1f5f9",
    today: "rgba(30,58,138,0.04)", inputBg: "#f8fafc",
    calHeader: "#f8fafc", headerBorder: "#e2e8f0",
  };

  // ── State ────────────────────────────────────────────────────────────────────
  const [salones, setSalones] = useState<Salon[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSalonId, setSelectedSalonId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));

  // Modals
  const [showSalonModal, setShowSalonModal] = useState(false);
  const [showResModal, setShowResModal] = useState(false);
  const [editingSalon, setEditingSalon] = useState<Salon | null>(null);
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [salonForm, setSalonForm] = useState(emptySalonForm());
  const [resForm, setResForm] = useState(emptyResForm());
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "salon" | "res"; id: string } | null>(null);

  // ── Load data ─────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [salonData, resData, hotelData] = await Promise.all([
        apiFetch<Salon[]>("/salones"),
        apiFetch<Reservation[]>("/salones/reservations/all"),
        apiFetch<Hotel[]>("/accommodations"),
      ]);
      setSalones(Array.isArray(salonData) ? salonData : []);
      setReservations(Array.isArray(resData) ? resData : []);
      setHotels(Array.isArray(hotelData) ? hotelData : []);
      if (!selectedSalonId && Array.isArray(salonData) && salonData.length > 0) {
        setSelectedSalonId(salonData[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [selectedSalonId]);

  useEffect(() => { loadData(); }, []);

  // ── Derived data ──────────────────────────────────────────────────────────────
  const selectedSalon = salones.find((s) => s.id === selectedSalonId) ?? null;

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const calendarReservations = useMemo(() => {
    if (!selectedSalonId) return {};
    const map: Record<string, Reservation[]> = {};
    reservations
      .filter((r) => r.salonId === selectedSalonId && r.status !== "CANCELLED")
      .forEach((r) => {
        // expand multi-day reservations
        let cur = new Date(r.startDate + "T00:00:00");
        const end = new Date(r.endDate + "T00:00:00");
        while (cur <= end) {
          const key = toDateStr(cur);
          if (!map[key]) map[key] = [];
          map[key].push(r);
          cur = addDays(cur, 1);
        }
      });
    return map;
  }, [reservations, selectedSalonId]);

  const upcomingReservations = useMemo(() => {
    const today = toDateStr(new Date());
    return reservations
      .filter((r) => r.salonId === selectedSalonId && r.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.startTime.localeCompare(b.startTime));
  }, [reservations, selectedSalonId]);

  // ── Salon CRUD ────────────────────────────────────────────────────────────────
  const openCreateSalon = () => {
    setEditingSalon(null);
    setSalonForm(emptySalonForm());
    setModalError(null);
    setShowSalonModal(true);
  };

  const openEditSalon = (salon: Salon) => {
    setEditingSalon(salon);
    setSalonForm({
      hotelId: salon.hotelId, name: salon.name, type: salon.type,
      capacity: String(salon.capacity), status: salon.status,
      floor: salon.floor ?? "", notes: salon.notes ?? "",
    });
    setModalError(null);
    setShowSalonModal(true);
  };

  const saveSalon = async () => {
    if (!salonForm.hotelId || !salonForm.name.trim()) {
      setModalError("Hotel y nombre son obligatorios.");
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const body = {
        hotelId: salonForm.hotelId, name: salonForm.name.trim(),
        type: salonForm.type, capacity: Number(salonForm.capacity) || 0,
        status: salonForm.status,
        floor: salonForm.floor || undefined, notes: salonForm.notes || undefined,
      };
      if (editingSalon) {
        await apiFetch(`/salones/${editingSalon.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await apiFetch("/salones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      setShowSalonModal(false);
      await loadData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  const deleteSalon = async (id: string) => {
    try {
      await apiFetch(`/salones/${id}`, { method: "DELETE" });
      if (selectedSalonId === id) setSelectedSalonId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando salón");
    } finally {
      setConfirmDelete(null);
    }
  };

  // ── Reservation CRUD ──────────────────────────────────────────────────────────
  const openCreateRes = (date?: string) => {
    setEditingRes(null);
    setResForm(emptyResForm(selectedSalonId, date ?? toDateStr(new Date())));
    setModalError(null);
    setShowResModal(true);
  };

  const openEditRes = (res: Reservation) => {
    setEditingRes(res);
    setResForm({
      salonId: res.salonId, title: res.title,
      organizerName: res.organizerName ?? "", organizerEmail: res.organizerEmail ?? "",
      startDate: res.startDate, endDate: res.endDate,
      startTime: res.startTime.slice(0, 5), endTime: res.endTime.slice(0, 5),
      attendees: res.attendees != null ? String(res.attendees) : "",
      status: res.status, notes: res.notes ?? "",
    });
    setModalError(null);
    setShowResModal(true);
  };

  const saveReservation = async () => {
    if (!resForm.salonId || !resForm.title.trim() || !resForm.startDate || !resForm.startTime || !resForm.endTime) {
      setModalError("Salón, título, fecha y horario son obligatorios.");
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const body = {
        salonId: resForm.salonId, title: resForm.title.trim(),
        organizerName: resForm.organizerName || undefined,
        organizerEmail: resForm.organizerEmail || undefined,
        startDate: resForm.startDate, endDate: resForm.endDate || resForm.startDate,
        startTime: resForm.startTime, endTime: resForm.endTime,
        attendees: resForm.attendees ? Number(resForm.attendees) : undefined,
        status: resForm.status, notes: resForm.notes || undefined,
      };
      if (editingRes) {
        await apiFetch(`/salones/reservations/${editingRes.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await apiFetch("/salones/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      setShowResModal(false);
      await loadData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  const deleteReservation = async (id: string) => {
    try {
      await apiFetch(`/salones/reservations/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando reserva");
    } finally {
      setConfirmDelete(null);
    }
  };

  // ── Input style ──────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: "8px",
    border: `1px solid ${pal.panelBorder}`, background: pal.inputBg,
    color: pal.text, fontSize: "13px", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: 600, color: pal.textFaint,
    textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "5px",
  };

  // ── Calendar block position ───────────────────────────────────────────────────
  function blockStyle(res: Reservation): React.CSSProperties {
    const startMin = timeToMinutes(res.startTime.slice(0, 5));
    const endMin   = timeToMinutes(res.endTime.slice(0, 5));
    const top    = Math.max(0, (startMin - HOUR_START * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max(20, ((endMin - startMin) / 60) * HOUR_HEIGHT - 2);
    const sc = RES_STATUS_COLOR[res.status] ?? RES_STATUS_COLOR.CONFIRMED;
    return {
      position: "absolute", top: `${top}px`, left: "3px", right: "3px", height: `${height}px`,
      background: sc.bg, border: `1px solid ${sc.border}`, borderLeft: `3px solid ${sc.dot}`,
      borderRadius: "6px", padding: "4px 7px", overflow: "hidden",
      cursor: "pointer", zIndex: 10,
      transition: "filter 120ms",
    };
  }

  const todayStr = toDateStr(new Date());

  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: pal.accent }}>
            Hotelería
          </p>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: pal.text, marginTop: "2px" }}>
            Reserva de salones
          </h1>
          <p style={{ fontSize: "13px", color: pal.textMuted, marginTop: "2px" }}>
            Gestiona salones, reservas y visualiza la ocupación semanal
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={openCreateSalon} style={{
            padding: "8px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
            background: "transparent", border: `1px solid ${pal.panelBorder}`, color: pal.textMuted, cursor: "pointer",
          }}>
            + Nuevo salón
          </button>
          <button
            onClick={() => openCreateRes()}
            disabled={!selectedSalonId}
            style={{
              padding: "8px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
              background: pal.accent, color: "#fff", border: "none", cursor: selectedSalonId ? "pointer" : "not-allowed",
              opacity: selectedSalonId ? 1 : 0.5,
            }}
          >
            + Nueva reserva
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* ── Body: sidebar + calendar ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "16px", alignItems: "start" }}>

        {/* ── Salones sidebar ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {loading && salones.length === 0 ? (
            <p style={{ color: pal.textFaint, fontSize: "13px" }}>Cargando...</p>
          ) : salones.length === 0 ? (
            <div style={{
              background: pal.panelBg, border: `1px dashed ${pal.panelBorder}`,
              borderRadius: "14px", padding: "24px", textAlign: "center",
            }}>
              <p style={{ fontSize: "28px", marginBottom: "8px" }}>🏛️</p>
              <p style={{ color: pal.textMuted, fontSize: "13px" }}>Sin salones creados</p>
              <button onClick={openCreateSalon} style={{
                marginTop: "12px", padding: "7px 14px", borderRadius: "8px", fontSize: "12px",
                background: pal.accent, color: "#fff", border: "none", cursor: "pointer", fontWeight: 600,
              }}>
                Crear primer salón
              </button>
            </div>
          ) : salones.map((salon) => {
            const isSelected = salon.id === selectedSalonId;
            const resCount = reservations.filter((r) => r.salonId === salon.id && r.startDate >= todayStr && r.status !== "CANCELLED").length;
            return (
              <div
                key={salon.id}
                onClick={() => setSelectedSalonId(salon.id)}
                style={{
                  background: isSelected ? `${pal.accent}18` : pal.panelBg,
                  border: `1px solid ${isSelected ? pal.accent : pal.panelBorder}`,
                  borderRadius: "14px", padding: "14px 16px", cursor: "pointer",
                  transition: "all 120ms ease", boxShadow: pal.shadow,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>{SALON_TYPE_ICON[salon.type] ?? "🏛️"}</span>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "13px", color: isSelected ? pal.accent : pal.text }}>{salon.name}</p>
                      <p style={{ fontSize: "11px", color: pal.textFaint, marginTop: "1px" }}>
                        {SALON_TYPES.find((t) => t.value === salon.type)?.label ?? salon.type}
                        {salon.floor ? ` · Piso ${salon.floor}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditSalon(salon); }}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: pal.textFaint, fontSize: "14px", padding: "2px 4px" }}
                  >✏️</button>
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <span style={{
                    fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px",
                    background: salon.status === "ACTIVE" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    color: salon.status === "ACTIVE" ? "#10b981" : "#ef4444",
                    border: `1px solid ${salon.status === "ACTIVE" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                  }}>
                    {SALON_STATUS.find((s) => s.value === salon.status)?.label ?? salon.status}
                  </span>
                  {salon.capacity > 0 && (
                    <span style={{ fontSize: "10px", color: pal.textFaint }}>👥 {salon.capacity}</span>
                  )}
                  {resCount > 0 && (
                    <span style={{
                      fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "99px",
                      background: `${pal.accent}18`, color: pal.accent, border: `1px solid ${pal.accent}33`,
                    }}>
                      {resCount} próx.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Right panel: calendar + list ────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {!selectedSalon ? (
            <div style={{
              background: pal.panelBg, border: `1px dashed ${pal.panelBorder}`,
              borderRadius: "16px", padding: "60px 24px", textAlign: "center",
            }}>
              <p style={{ fontSize: "40px", marginBottom: "12px" }}>🗓️</p>
              <p style={{ color: pal.textMuted, fontSize: "15px", fontWeight: 600 }}>Selecciona un salón</p>
              <p style={{ color: pal.textFaint, fontSize: "13px", marginTop: "4px" }}>para ver su calendario de ocupación</p>
            </div>
          ) : (
            <>
              {/* Calendar card */}
              <div style={{
                background: pal.panelBg, border: `1px solid ${pal.panelBorder}`,
                borderRadius: "16px", boxShadow: pal.shadow, overflow: "hidden",
              }}>
                {/* Calendar header */}
                <div style={{
                  background: pal.calHeader, borderBottom: `1px solid ${pal.headerBorder}`,
                  padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: pal.accent, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                      {selectedSalon.name}
                    </p>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: pal.text, marginTop: "2px" }}>
                      {MONTHS_ES[weekStart.getMonth()].charAt(0).toUpperCase() + MONTHS_ES[weekStart.getMonth()].slice(1)} {weekStart.getFullYear()}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button onClick={() => setWeekStart(getWeekStart(new Date()))} style={{
                      padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                      background: "transparent", border: `1px solid ${pal.panelBorder}`, color: pal.textMuted, cursor: "pointer",
                    }}>Hoy</button>
                    <button onClick={() => setWeekStart((w) => addDays(w, -7))} style={{
                      width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${pal.panelBorder}`,
                      background: "transparent", color: pal.textMuted, cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>‹</button>
                    <button onClick={() => setWeekStart((w) => addDays(w, 7))} style={{
                      width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${pal.panelBorder}`,
                      background: "transparent", color: pal.textMuted, cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>›</button>
                    <button onClick={() => openCreateRes()} style={{
                      padding: "5px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                      background: pal.accent, color: "#fff", border: "none", cursor: "pointer",
                    }}>+ Reserva</button>
                  </div>
                </div>

                {/* Day column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", borderBottom: `1px solid ${pal.headerBorder}` }}>
                  <div style={{ background: pal.calHeader }} />
                  {weekDays.map((day, i) => {
                    const ds = toDateStr(day);
                    const isToday = ds === todayStr;
                    const dayRes = calendarReservations[ds] ?? [];
                    return (
                      <div
                        key={i}
                        style={{
                          background: isToday ? pal.today : pal.calHeader,
                          borderLeft: `1px solid ${pal.headerBorder}`,
                          padding: "10px 4px", textAlign: "center", cursor: "pointer",
                        }}
                        onClick={() => openCreateRes(ds)}
                        title={`Añadir reserva el ${ds}`}
                      >
                        <p style={{ fontSize: "10px", fontWeight: 600, color: pal.textFaint, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                          {DAYS_ES[day.getDay()]}
                        </p>
                        <p style={{
                          fontSize: "18px", fontWeight: 800, marginTop: "2px",
                          color: isToday ? pal.accent : pal.text,
                          ...(isToday ? { textShadow: `0 0 16px ${pal.accent}66` } : {}),
                        }}>
                          {day.getDate()}
                        </p>
                        {dayRes.length > 0 && (
                          <div style={{ display: "flex", justifyContent: "center", gap: "2px", marginTop: "4px" }}>
                            {dayRes.slice(0, 3).map((r, ri) => {
                              const sc = RES_STATUS_COLOR[r.status] ?? RES_STATUS_COLOR.CONFIRMED;
                              return <span key={ri} style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.dot, display: "inline-block" }} />;
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Time grid */}
                <div style={{ overflowY: "auto", maxHeight: "520px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", position: "relative" }}>
                    {/* Hour labels */}
                    <div>
                      {HOURS.map((h) => (
                        <div key={h} style={{ height: `${HOUR_HEIGHT}px`, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: "8px", paddingTop: "4px" }}>
                          <span style={{ fontSize: "10px", color: pal.textFaint, fontVariantNumeric: "tabular-nums" }}>{h}:00</span>
                        </div>
                      ))}
                    </div>

                    {/* Day columns */}
                    {weekDays.map((day, di) => {
                      const ds = toDateStr(day);
                      const isToday = ds === todayStr;
                      const dayRes = calendarReservations[ds] ?? [];
                      return (
                        <div
                          key={di}
                          style={{
                            borderLeft: `1px solid ${pal.headerBorder}`,
                            position: "relative",
                            background: isToday ? pal.today : "transparent",
                          }}
                        >
                          {/* Hour lines */}
                          {HOURS.map((h) => (
                            <div key={h} style={{
                              height: `${HOUR_HEIGHT}px`,
                              borderTop: `1px solid ${h === HOUR_START ? "transparent" : pal.gridLine}`,
                            }} />
                          ))}
                          {/* Reservation blocks */}
                          {dayRes.map((res) => {
                            const sc = RES_STATUS_COLOR[res.status] ?? RES_STATUS_COLOR.CONFIRMED;
                            return (
                              <div
                                key={res.id}
                                style={blockStyle(res)}
                                onClick={(e) => { e.stopPropagation(); openEditRes(res); }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.12)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ""; }}
                              >
                                <p style={{ fontSize: "11px", fontWeight: 700, color: sc.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {res.title}
                                </p>
                                <p style={{ fontSize: "10px", color: sc.text, opacity: 0.75, marginTop: "1px" }}>
                                  {formatTime(res.startTime)} – {formatTime(res.endTime)}
                                </p>
                                {res.organizerName && (
                                  <p style={{ fontSize: "9px", color: sc.text, opacity: 0.6, marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {res.organizerName}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Upcoming reservations list */}
              <div style={{
                background: pal.panelBg, border: `1px solid ${pal.panelBorder}`,
                borderRadius: "16px", padding: "20px", boxShadow: pal.shadow,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <div>
                    <p style={{ fontSize: "11px", color: pal.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                      Próximas reservas
                    </p>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: pal.text, marginTop: "2px" }}>
                      {selectedSalon.name}
                    </p>
                  </div>
                  <button onClick={() => openCreateRes()} style={{
                    padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                    background: `${pal.accent}18`, color: pal.accent, border: `1px solid ${pal.accent}33`, cursor: "pointer",
                  }}>
                    + Reservar
                  </button>
                </div>

                {upcomingReservations.length === 0 ? (
                  <p style={{ color: pal.textFaint, fontSize: "13px", textAlign: "center", padding: "24px 0" }}>
                    Sin reservas próximas
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {upcomingReservations.map((res) => {
                      const sc = RES_STATUS_COLOR[res.status] ?? RES_STATUS_COLOR.CONFIRMED;
                      const statusLabel = RES_STATUS.find((s) => s.value === res.status)?.label ?? res.status;
                      return (
                        <div
                          key={res.id}
                          style={{
                            background: pal.cardBg, border: `1px solid ${pal.cardBorder}`,
                            borderLeft: `3px solid ${sc.dot}`, borderRadius: "10px", padding: "12px 14px",
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: "13px", color: pal.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {res.title}
                            </p>
                            <div style={{ display: "flex", gap: "10px", marginTop: "4px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "11px", color: pal.textMuted }}>
                                📅 {isoToDisplay(res.startDate)}{res.endDate !== res.startDate ? ` → ${isoToDisplay(res.endDate)}` : ""}
                              </span>
                              <span style={{ fontSize: "11px", color: pal.textMuted }}>
                                🕐 {formatTime(res.startTime)} – {formatTime(res.endTime)}
                              </span>
                              {res.organizerName && (
                                <span style={{ fontSize: "11px", color: pal.textMuted }}>👤 {res.organizerName}</span>
                              )}
                              {res.attendees && (
                                <span style={{ fontSize: "11px", color: pal.textMuted }}>👥 {res.attendees}</span>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                            <span style={{
                              fontSize: "10px", fontWeight: 700, padding: "3px 9px", borderRadius: "99px",
                              background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                            }}>
                              {statusLabel}
                            </span>
                            <button onClick={() => openEditRes(res)} style={{ background: "transparent", border: "none", cursor: "pointer", color: pal.textFaint, fontSize: "13px", padding: "2px" }}>✏️</button>
                            <button onClick={() => setConfirmDelete({ type: "res", id: res.id })} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "13px", padding: "2px" }}>🗑️</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          Modal: Salón
      ══════════════════════════════════════════════════════ */}
      {showSalonModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSalonModal(false); }}
        >
          <div style={{
            background: pal.panelBg, border: `1px solid ${pal.panelBorder}`,
            borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "480px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 800, color: pal.text }}>
                {editingSalon ? "Editar salón" : "Nuevo salón"}
              </h2>
              <button onClick={() => setShowSalonModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: pal.textFaint, fontSize: "18px" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Hotel *</label>
                <select style={inputStyle} value={salonForm.hotelId} onChange={(e) => setSalonForm({ ...salonForm, hotelId: e.target.value })}>
                  <option value="">Selecciona un hotel</option>
                  {hotels.map((h) => <option key={h.id} value={h.id}>{h.name || h.id}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Nombre *</label>
                <input style={inputStyle} value={salonForm.name} onChange={(e) => setSalonForm({ ...salonForm, name: e.target.value })} placeholder="Ej: Sala Andino" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select style={inputStyle} value={salonForm.type} onChange={(e) => setSalonForm({ ...salonForm, type: e.target.value })}>
                    {SALON_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Estado</label>
                  <select style={inputStyle} value={salonForm.status} onChange={(e) => setSalonForm({ ...salonForm, status: e.target.value })}>
                    {SALON_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Capacidad (personas)</label>
                  <input style={inputStyle} type="number" min={0} value={salonForm.capacity} onChange={(e) => setSalonForm({ ...salonForm, capacity: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <label style={labelStyle}>Piso / Ubicación</label>
                  <input style={inputStyle} value={salonForm.floor} onChange={(e) => setSalonForm({ ...salonForm, floor: e.target.value })} placeholder="Ej: 2" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notas</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: "64px" }} value={salonForm.notes} onChange={(e) => setSalonForm({ ...salonForm, notes: e.target.value })} placeholder="Equipamiento, restricciones, etc." />
              </div>
            </div>

            {modalError && (
              <p style={{ marginTop: "12px", fontSize: "12px", color: "#ef4444" }}>{modalError}</p>
            )}

            <div style={{ display: "flex", gap: "8px", marginTop: "20px", justifyContent: "flex-end" }}>
              {editingSalon && (
                <button
                  onClick={() => { setShowSalonModal(false); setConfirmDelete({ type: "salon", id: editingSalon.id }); }}
                  style={{ padding: "8px 14px", borderRadius: "9px", fontSize: "13px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", cursor: "pointer" }}
                >
                  Eliminar
                </button>
              )}
              <button onClick={() => setShowSalonModal(false)} style={{ padding: "8px 14px", borderRadius: "9px", fontSize: "13px", background: "transparent", border: `1px solid ${pal.panelBorder}`, color: pal.textMuted, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={saveSalon} disabled={saving} style={{
                padding: "8px 20px", borderRadius: "9px", fontSize: "13px", fontWeight: 700,
                background: pal.accent, color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              }}>
                {saving ? "Guardando..." : editingSalon ? "Actualizar" : "Crear salón"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          Modal: Reserva
      ══════════════════════════════════════════════════════ */}
      {showResModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowResModal(false); }}
        >
          <div style={{
            background: pal.panelBg, border: `1px solid ${pal.panelBorder}`,
            borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "520px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.4)", maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 800, color: pal.text }}>
                {editingRes ? "Editar reserva" : "Nueva reserva"}
              </h2>
              <button onClick={() => setShowResModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: pal.textFaint, fontSize: "18px" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Salón *</label>
                <select style={inputStyle} value={resForm.salonId} onChange={(e) => setResForm({ ...resForm, salonId: e.target.value })}>
                  <option value="">Selecciona un salón</option>
                  {salones.map((s) => <option key={s.id} value={s.id}>{SALON_TYPE_ICON[s.type] ?? "🏛️"} {s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Título *</label>
                <input style={inputStyle} value={resForm.title} onChange={(e) => setResForm({ ...resForm, title: e.target.value })} placeholder="Ej: Reunión técnica delegaciones" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Fecha inicio *</label>
                  <input style={inputStyle} type="date" value={resForm.startDate} onChange={(e) => setResForm({ ...resForm, startDate: e.target.value, endDate: resForm.endDate || e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Fecha fin</label>
                  <input style={inputStyle} type="date" value={resForm.endDate} onChange={(e) => setResForm({ ...resForm, endDate: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Hora inicio *</label>
                  <input style={inputStyle} type="time" value={resForm.startTime} onChange={(e) => setResForm({ ...resForm, startTime: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Hora fin *</label>
                  <input style={inputStyle} type="time" value={resForm.endTime} onChange={(e) => setResForm({ ...resForm, endTime: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Organizador</label>
                  <input style={inputStyle} value={resForm.organizerName} onChange={(e) => setResForm({ ...resForm, organizerName: e.target.value })} placeholder="Nombre" />
                </div>
                <div>
                  <label style={labelStyle}>Asistentes</label>
                  <input style={inputStyle} type="number" min={0} value={resForm.attendees} onChange={(e) => setResForm({ ...resForm, attendees: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email organizador</label>
                <input style={inputStyle} type="email" value={resForm.organizerEmail} onChange={(e) => setResForm({ ...resForm, organizerEmail: e.target.value })} placeholder="correo@ejemplo.com" />
              </div>
              <div>
                <label style={labelStyle}>Estado</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {RES_STATUS.map((s) => {
                    const sc = RES_STATUS_COLOR[s.value];
                    const isActive = resForm.status === s.value;
                    return (
                      <button
                        key={s.value}
                        onClick={() => setResForm({ ...resForm, status: s.value })}
                        style={{
                          flex: 1, padding: "7px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                          background: isActive ? sc.bg : "transparent",
                          border: `1px solid ${isActive ? sc.border : pal.panelBorder}`,
                          color: isActive ? sc.text : pal.textMuted,
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notas</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }} value={resForm.notes} onChange={(e) => setResForm({ ...resForm, notes: e.target.value })} placeholder="Requerimientos especiales, equipamiento..." />
              </div>
            </div>

            {modalError && (
              <p style={{ marginTop: "12px", fontSize: "12px", color: "#ef4444" }}>{modalError}</p>
            )}

            <div style={{ display: "flex", gap: "8px", marginTop: "20px", justifyContent: "flex-end" }}>
              {editingRes && (
                <button
                  onClick={() => { setShowResModal(false); setConfirmDelete({ type: "res", id: editingRes.id }); }}
                  style={{ padding: "8px 14px", borderRadius: "9px", fontSize: "13px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", cursor: "pointer" }}
                >
                  Eliminar
                </button>
              )}
              <button onClick={() => setShowResModal(false)} style={{ padding: "8px 14px", borderRadius: "9px", fontSize: "13px", background: "transparent", border: `1px solid ${pal.panelBorder}`, color: pal.textMuted, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={saveReservation} disabled={saving} style={{
                padding: "8px 20px", borderRadius: "9px", fontSize: "13px", fontWeight: 700,
                background: pal.accent, color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              }}>
                {saving ? "Guardando..." : editingRes ? "Actualizar" : "Crear reserva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          Confirm delete modal
      ══════════════════════════════════════════════════════ */}
      {confirmDelete && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1100,
          background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        }}>
          <div style={{
            background: pal.panelBg, border: `1px solid rgba(239,68,68,0.35)`,
            borderRadius: "18px", padding: "28px", width: "100%", maxWidth: "380px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)", textAlign: "center",
          }}>
            <p style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</p>
            <p style={{ fontWeight: 700, fontSize: "16px", color: pal.text }}>¿Confirmar eliminación?</p>
            <p style={{ color: pal.textMuted, fontSize: "13px", marginTop: "6px" }}>
              {confirmDelete.type === "salon"
                ? "Se eliminará el salón y todas sus reservas."
                : "Se eliminará esta reserva permanentemente."}
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "center" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "9px 18px", borderRadius: "9px", fontSize: "13px", background: "transparent", border: `1px solid ${pal.panelBorder}`, color: pal.textMuted, cursor: "pointer" }}>
                Cancelar
              </button>
              <button
                onClick={() => confirmDelete.type === "salon" ? deleteSalon(confirmDelete.id) : deleteReservation(confirmDelete.id)}
                style={{ padding: "9px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: 700, background: "#ef4444", color: "#fff", border: "none", cursor: "pointer" }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
