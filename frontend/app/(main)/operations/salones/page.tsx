"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

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
  SALA_REUNION: "Reunión", AUDITORIO: "Auditorio", SALON_EVENTOS: "Eventos",
  COMEDOR: "Comedor", SALA_PRENSA: "Prensa", OTRO: "Otro",
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

function durationLabel(startTime: string, endTime: string): string {
  const diff = timeToMinutes(endTime.slice(0, 5)) - timeToMinutes(startTime.slice(0, 5));
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function toDateOnly(d: string): string {
  return d ? d.slice(0, 10) : "";
}

function isoToDisplay(d: string): string {
  const safe = toDateOnly(d);
  const [y, mo, day] = safe.split("-");
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
  const { locale, t } = useI18n();
  const dateLocale = locale === "en" ? "en-US" : locale === "pt" ? "pt-BR" : "es-CL";

  // ── Palette ─────────────────────────────────────────────────────────────────
  const pal = {
    panelBg: "#ffffff", panelBorder: "#e2e8f0",
    cardBg: "#ffffff", cardBorder: "#e2e8f0", shadow: "0 1px 4px rgba(15,23,42,0.06)",
    accent: "#21D0B3",
    text: "#0f172a", textMuted: "#64748b", textFaint: "#94a3b8",
    gridLine: "#f1f5f9",
    today: "rgba(33,208,179,0.04)", inputBg: "#f8fafc",
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
      setError(err instanceof Error ? err.message : t("Error cargando datos"));
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
        const startD = toDateOnly(r.startDate);
        const endD   = toDateOnly(r.endDate);
        let cur = new Date(startD + "T00:00:00");
        const end = new Date(endD + "T00:00:00");
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
      .filter((r) => r.salonId === selectedSalonId && toDateOnly(r.endDate) >= today)
      .sort((a, b) => toDateOnly(a.startDate).localeCompare(toDateOnly(b.startDate)) || a.startTime.localeCompare(b.startTime));
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
      setModalError(t("Hotel y nombre son obligatorios."));
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
      setModalError(err instanceof Error ? err.message : t("Error guardando"));
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
      setError(err instanceof Error ? err.message : t("Error eliminando salón"));
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
      setModalError(t("Salón, título, fecha y horario son obligatorios."));
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
      setModalError(err instanceof Error ? err.message : t("Error guardando"));
    } finally {
      setSaving(false);
    }
  };

  const deleteReservation = async (id: string) => {
    try {
      await apiFetch(`/salones/reservations/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Error eliminando reserva"));
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "3px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#21D0B3" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#21D0B3", display: "inline-block" }} />
            {t("Hotelería")}
          </span>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginTop: "8px" }}>
            {t("Reserva de salones")}
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
            {t("Gestiona salones, reservas y visualiza la ocupación semanal")}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={openCreateSalon} style={{
            padding: "8px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
            background: "#ffffff", border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer",
          }}>
            {t("+ Nuevo salón")}
          </button>
          <button
            onClick={() => openCreateRes()}
            disabled={!selectedSalonId}
            style={{
              padding: "8px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
              background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#fff", border: "none",
              cursor: selectedSalonId ? "pointer" : "not-allowed", opacity: selectedSalonId ? 1 : 0.5,
              boxShadow: "0 2px 10px rgba(33,208,179,0.3)",
            }}
          >
            {t("+ Nueva reserva")}
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
            <p style={{ color: pal.textFaint, fontSize: "13px" }}>{t("Cargando...")}</p>
          ) : salones.length === 0 ? (
            <div style={{
              background: "#ffffff", border: "1px dashed #e2e8f0",
              borderRadius: "14px", padding: "24px", textAlign: "center",
            }}>
              <p style={{ color: "#64748b", fontSize: "13px" }}>{t("Sin salones creados")}</p>
              <button onClick={openCreateSalon} style={{
                marginTop: "12px", padding: "7px 14px", borderRadius: "8px", fontSize: "12px",
                background: pal.accent, color: "#fff", border: "none", cursor: "pointer", fontWeight: 600,
              }}>
                {t("Crear primer salón")}
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
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "13px", color: isSelected ? pal.accent : pal.text }}>{salon.name}</p>
                      <p style={{ fontSize: "11px", color: pal.textFaint, marginTop: "1px" }}>
                        {t(SALON_TYPES.find((st) => st.value === salon.type)?.label ?? salon.type)}
                        {salon.floor ? ` · ${t("Piso")} ${salon.floor}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditSalon(salon); }}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8", padding: "2px 4px", display: "flex", alignItems: "center" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <span style={{
                    fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px",
                    background: salon.status === "ACTIVE" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    color: salon.status === "ACTIVE" ? "#10b981" : "#ef4444",
                    border: `1px solid ${salon.status === "ACTIVE" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                  }}>
                    {t(SALON_STATUS.find((s) => s.value === salon.status)?.label ?? salon.status)}
                  </span>
                  {salon.capacity > 0 && (
                    <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                      <svg style={{ display: "inline", marginRight: "3px", verticalAlign: "middle" }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {salon.capacity}
                    </span>
                  )}
                  {resCount > 0 && (
                    <span style={{
                      fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "99px",
                      background: `${pal.accent}18`, color: pal.accent, border: `1px solid ${pal.accent}33`,
                    }}>
                      {resCount} {t("próx.")}
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
              background: "#ffffff", border: "1px dashed #e2e8f0",
              borderRadius: "16px", padding: "60px 24px", textAlign: "center",
            }}>
              <p style={{ color: "#64748b", fontSize: "15px", fontWeight: 600 }}>{t("Selecciona un salón")}</p>
              <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>{t("para ver su calendario de ocupación")}</p>
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
                      {weekStart.toLocaleDateString(dateLocale, { month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button onClick={() => setWeekStart(getWeekStart(new Date()))} style={{
                      padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                      background: "transparent", border: `1px solid ${pal.panelBorder}`, color: pal.textMuted, cursor: "pointer",
                    }}>{t("Hoy")}</button>
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
                      background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#fff", border: "none", cursor: "pointer",
                    }}>+ {t("Reserva")}</button>
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
                        title={t("Añadir reserva el {date}").replace("{date}", ds)}
                      >
                        <p style={{ fontSize: "10px", fontWeight: 600, color: pal.textFaint, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                          {day.toLocaleDateString(dateLocale, { weekday: "short" })}
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
                            const startMin = timeToMinutes(res.startTime.slice(0, 5));
                            const endMin   = timeToMinutes(res.endTime.slice(0, 5));
                            const blockH   = Math.max(20, ((endMin - startMin) / 60) * HOUR_HEIGHT - 2);
                            const dur      = durationLabel(res.startTime, res.endTime);
                            const isShort  = blockH < 40;
                            const isMedium = blockH >= 40 && blockH < 72;
                            return (
                              <div
                                key={res.id}
                                style={blockStyle(res)}
                                onClick={(e) => { e.stopPropagation(); openEditRes(res); }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.13)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ""; }}
                              >
                                {isShort ? (
                                  /* Chip view: single line */
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px", height: "100%" }}>
                                    <span style={{ fontSize: "10px", fontWeight: 700, color: sc.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                      {res.title}
                                    </span>
                                    <span style={{ fontSize: "9px", color: sc.text, opacity: 0.7, whiteSpace: "nowrap", flexShrink: 0 }}>
                                      {formatTime(res.startTime)}
                                    </span>
                                  </div>
                                ) : (
                                  /* Card view: title + time + duration + organizer */
                                  <>
                                    <p style={{ fontSize: "11px", fontWeight: 700, color: sc.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                                      {res.title}
                                    </p>
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "2px", flexWrap: "nowrap", overflow: "hidden" }}>
                                      <span style={{ fontSize: "10px", color: sc.text, opacity: 0.8, whiteSpace: "nowrap" }}>
                                        {formatTime(res.startTime)} – {formatTime(res.endTime)}
                                      </span>
                                      {dur && (
                                        <span style={{
                                          fontSize: "9px", fontWeight: 600, padding: "0px 5px", borderRadius: "99px",
                                          background: `${sc.dot}28`, color: sc.text, opacity: 0.9,
                                          whiteSpace: "nowrap", flexShrink: 0,
                                        }}>
                                          {dur}
                                        </span>
                                      )}
                                    </div>
                                    {!isMedium && res.organizerName && (
                                      <p style={{ fontSize: "9px", color: sc.text, opacity: 0.6, marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {res.organizerName}
                                      </p>
                                    )}
                                    {!isMedium && res.attendees && (
                                      <p style={{ fontSize: "9px", color: sc.text, opacity: 0.6, marginTop: "1px" }}>
                                        {res.attendees} {t("asistentes")}
                                      </p>
                                    )}
                                  </>
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
                      {t("Próximas reservas")}
                    </p>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: pal.text, marginTop: "2px" }}>
                      {selectedSalon.name}
                    </p>
                  </div>
                  <button onClick={() => openCreateRes()} style={{
                    padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                    background: `${pal.accent}18`, color: pal.accent, border: `1px solid ${pal.accent}33`, cursor: "pointer",
                  }}>
                    + {t("Reservar")}
                  </button>
                </div>

                {upcomingReservations.length === 0 ? (
                  <p style={{ color: pal.textFaint, fontSize: "13px", textAlign: "center", padding: "24px 0" }}>
                    {t("Sin reservas próximas")}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {upcomingReservations.map((res) => {
                      const sc = RES_STATUS_COLOR[res.status] ?? RES_STATUS_COLOR.CONFIRMED;
                      const statusLabel = t(RES_STATUS.find((s) => s.value === res.status)?.label ?? res.status);
                      const dur = durationLabel(res.startTime, res.endTime);
                      const jumpToWeek = () => setWeekStart(getWeekStart(new Date(toDateOnly(res.startDate) + "T00:00:00")));
                      return (
                        <div
                          key={res.id}
                          onClick={() => { jumpToWeek(); openEditRes(res); }}
                          style={{
                            background: pal.cardBg, border: `1px solid ${pal.cardBorder}`,
                            borderLeft: `3px solid ${sc.dot}`, borderRadius: "10px", padding: "12px 14px",
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                            cursor: "pointer", transition: "filter 120ms",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = "brightness(0.95)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ""; }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: "13px", color: pal.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {res.title}
                            </p>
                            <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap", alignItems: "center" }}>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>
                                {isoToDisplay(res.startDate)}{res.endDate !== res.startDate ? ` → ${isoToDisplay(res.endDate)}` : ""}
                              </span>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>
                                {formatTime(res.startTime)} – {formatTime(res.endTime)}
                              </span>
                              {dur && (
                                <span style={{
                                  fontSize: "10px", fontWeight: 600, padding: "1px 7px", borderRadius: "99px",
                                  background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                                }}>
                                  {dur}
                                </span>
                              )}
                              {res.organizerName && (
                                <span style={{ fontSize: "11px", color: "#64748b" }}>{res.organizerName}</span>
                              )}
                              {res.attendees && (
                                <span style={{ fontSize: "11px", color: "#64748b" }}>{res.attendees} {t("asistentes")}</span>
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
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "res", id: res.id }); }}
                              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: "2px", display: "flex", alignItems: "center" }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            </button>
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
                {editingSalon ? t("Editar salón") : t("Nuevo salón")}
              </h2>
              <button onClick={() => setShowSalonModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: pal.textFaint, fontSize: "18px" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>{t("Hotel")} *</label>
                <select style={inputStyle} value={salonForm.hotelId} onChange={(e) => setSalonForm({ ...salonForm, hotelId: e.target.value })}>
                  <option value="">{t("Selecciona un hotel")}</option>
                  {hotels.map((h) => <option key={h.id} value={h.id}>{h.name || h.id}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t("Nombre")} *</label>
                <input style={inputStyle} value={salonForm.name} onChange={(e) => setSalonForm({ ...salonForm, name: e.target.value })} placeholder={t("Ej: Sala Andino")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>{t("Tipo")}</label>
                  <select style={inputStyle} value={salonForm.type} onChange={(e) => setSalonForm({ ...salonForm, type: e.target.value })}>
                    {SALON_TYPES.map((st) => <option key={st.value} value={st.value}>{t(st.label)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t("Estado")}</label>
                  <select style={inputStyle} value={salonForm.status} onChange={(e) => setSalonForm({ ...salonForm, status: e.target.value })}>
                    {SALON_STATUS.map((s) => <option key={s.value} value={s.value}>{t(s.label)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>{t("Capacidad (personas)")}</label>
                  <input style={inputStyle} type="number" min={0} value={salonForm.capacity} onChange={(e) => setSalonForm({ ...salonForm, capacity: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <label style={labelStyle}>{t("Piso / Ubicación")}</label>
                  <input style={inputStyle} value={salonForm.floor} onChange={(e) => setSalonForm({ ...salonForm, floor: e.target.value })} placeholder="Ej: 2" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>{t("Notas")}</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: "64px" }} value={salonForm.notes} onChange={(e) => setSalonForm({ ...salonForm, notes: e.target.value })} placeholder={t("Equipamiento, restricciones, etc.")} />
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
                  {t("Eliminar")}
                </button>
              )}
              <button onClick={() => setShowSalonModal(false)} style={{ padding: "8px 14px", borderRadius: "9px", fontSize: "13px", background: "transparent", border: `1px solid ${pal.panelBorder}`, color: pal.textMuted, cursor: "pointer" }}>
                {t("Cancelar")}
              </button>
              <button onClick={saveSalon} disabled={saving} style={{
                padding: "8px 20px", borderRadius: "9px", fontSize: "13px", fontWeight: 700,
                background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              }}>
                {saving ? t("Guardando...") : editingSalon ? t("Actualizar") : t("Crear salón")}
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
                {editingRes ? t("Editar reserva") : t("Nueva reserva")}
              </h2>
              <button onClick={() => setShowResModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: pal.textFaint, fontSize: "18px" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>{t("Salón")} *</label>
                <select style={inputStyle} value={resForm.salonId} onChange={(e) => setResForm({ ...resForm, salonId: e.target.value })}>
                  <option value="">{t("Selecciona un salón")}</option>
                  {salones.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t("Título")} *</label>
                <input style={inputStyle} value={resForm.title} onChange={(e) => setResForm({ ...resForm, title: e.target.value })} placeholder={t("Ej: Reunión técnica delegaciones")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>{t("Fecha inicio")} *</label>
                  <input style={inputStyle} type="date" value={resForm.startDate} onChange={(e) => setResForm({ ...resForm, startDate: e.target.value, endDate: resForm.endDate || e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>{t("Fecha fin")}</label>
                  <input style={inputStyle} type="date" value={resForm.endDate} onChange={(e) => setResForm({ ...resForm, endDate: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>{t("Hora inicio")} *</label>
                  <input style={inputStyle} type="time" value={resForm.startTime} onChange={(e) => setResForm({ ...resForm, startTime: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>{t("Hora fin")} *</label>
                  <input style={inputStyle} type="time" value={resForm.endTime} onChange={(e) => setResForm({ ...resForm, endTime: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>{t("Organizador")}</label>
                  <input style={inputStyle} value={resForm.organizerName} onChange={(e) => setResForm({ ...resForm, organizerName: e.target.value })} placeholder={t("Nombre")} />
                </div>
                <div>
                  <label style={labelStyle}>{t("Asistentes")}</label>
                  <input style={inputStyle} type="number" min={0} value={resForm.attendees} onChange={(e) => setResForm({ ...resForm, attendees: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>{t("Email organizador")}</label>
                <input style={inputStyle} type="email" value={resForm.organizerEmail} onChange={(e) => setResForm({ ...resForm, organizerEmail: e.target.value })} placeholder="correo@ejemplo.com" />
              </div>
              <div>
                <label style={labelStyle}>{t("Estado")}</label>
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
                        {t(s.label)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>{t("Notas")}</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }} value={resForm.notes} onChange={(e) => setResForm({ ...resForm, notes: e.target.value })} placeholder={t("Requerimientos especiales, equipamiento...")} />
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
                  {t("Eliminar")}
                </button>
              )}
              <button onClick={() => setShowResModal(false)} style={{ padding: "8px 14px", borderRadius: "9px", fontSize: "13px", background: "transparent", border: `1px solid ${pal.panelBorder}`, color: pal.textMuted, cursor: "pointer" }}>
                {t("Cancelar")}
              </button>
              <button onClick={saveReservation} disabled={saving} style={{
                padding: "8px 20px", borderRadius: "9px", fontSize: "13px", fontWeight: 700,
                background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              }}>
                {saving ? t("Guardando...") : editingRes ? t("Actualizar") : t("Crear reserva")}
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
            <p style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}>{t("¿Confirmar eliminación?")}</p>
            <p style={{ color: pal.textMuted, fontSize: "13px", marginTop: "6px" }}>
              {confirmDelete.type === "salon"
                ? t("Se eliminará el salón y todas sus reservas.")
                : t("Se eliminará esta reserva permanentemente.")}
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "center" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "9px 18px", borderRadius: "9px", fontSize: "13px", background: "transparent", border: `1px solid ${pal.panelBorder}`, color: pal.textMuted, cursor: "pointer" }}>
                {t("Cancelar")}
              </button>
              <button
                onClick={() => confirmDelete.type === "salon" ? deleteSalon(confirmDelete.id) : deleteReservation(confirmDelete.id)}
                style={{ padding: "9px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: 700, background: "#ef4444", color: "#fff", border: "none", cursor: "pointer" }}
              >
                {t("Eliminar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
