"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Reservation = {
  id: string;
  extraId: string;
  participantId: string;
  quantity: number;
  notes: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type Extra = {
  id: string;
  name?: string | null;
  hotelId?: string | null;
};

type Athlete = {
  id: string;
  fullName?: string | null;
};

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  PENDING:   { bg: "rgba(245,158,11,0.15)",  border: "rgba(245,158,11,0.4)",  text: "#f59e0b" },
  APPROVED:  { bg: "rgba(16,185,129,0.15)",  border: "rgba(16,185,129,0.4)",  text: "#10b981" },
  REJECTED:  { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.35)",  text: "#ef4444" },
  DELIVERED: { bg: "rgba(99,102,241,0.15)",  border: "rgba(99,102,241,0.4)",  text: "#818cf8" },
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  DELIVERED: "Entregado",
};

const DAYS_SHORT = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

type FormState = {
  extraId: string;
  participantId: string;
  startDate: string;
  endDate: string;
  quantity: string;
  notes: string;
  status: string;
};

const EMPTY_FORM: FormState = {
  extraId: "",
  participantId: "",
  startDate: "",
  endDate: "",
  quantity: "1",
  notes: "",
  status: "PENDING",
};

export default function HotelExtraReservationsCalendar({
  refreshKey,
  onDataChanged,
}: {
  refreshKey: number;
  onDataChanged: () => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [extras, setExtras] = useState<Record<string, Extra>>({});
  const [athletes, setAthletes] = useState<Record<string, Athlete>>({});
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resData, extraData, athleteData] = await Promise.all([
        apiFetch<Reservation[]>("/hotel-extra-reservations"),
        apiFetch<Extra[]>("/hotel-extras"),
        apiFetch<Athlete[]>("/athletes"),
      ]);
      setReservations(resData || []);
      setExtras(
        (extraData || []).reduce<Record<string, Extra>>((acc, e) => {
          acc[e.id] = e;
          return acc;
        }, {})
      );
      setAthletes(
        (athleteData || []).reduce<Record<string, Athlete>>((acc, a) => {
          acc[a.id] = a;
          return acc;
        }, {})
      );
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Build calendar grid for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [year, month]);

  // Map: "YYYY-MM-DD" -> reservations active on that day
  const dayMap = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    for (const res of reservations) {
      if (!res.startDate || !res.endDate) {
        // no date range: show on createdAt date only
        const day = res.createdAt?.slice(0, 10);
        if (day) {
          if (!map[day]) map[day] = [];
          map[day].push(res);
        }
        continue;
      }
      const start = parseDateLocal(res.startDate);
      const end = parseDateLocal(res.endDate);
      const cur = new Date(start);
      while (cur <= end) {
        const key = toYMD(cur);
        if (!map[key]) map[key] = [];
        map[key].push(res);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [reservations]);

  const selectedDayReservations = useMemo(
    () => (selectedDay ? dayMap[selectedDay] || [] : []),
    [dayMap, selectedDay]
  );

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const openCreate = (day?: string) => {
    setForm({ ...EMPTY_FORM, startDate: day || "", endDate: day || "" });
    setEditingId(null);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (res: Reservation) => {
    setForm({
      extraId: res.extraId,
      participantId: res.participantId,
      startDate: res.startDate || "",
      endDate: res.endDate || "",
      quantity: String(res.quantity),
      notes: res.notes || "",
      status: res.status,
    });
    setEditingId(res.id);
    setShowForm(true);
    setError(null);
  };

  const handleSave = async () => {
    if (!form.extraId || !form.participantId) {
      setError("Extra y participante son obligatorios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        extraId: form.extraId,
        participantId: form.participantId,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        quantity: parseInt(form.quantity, 10) || 1,
        notes: form.notes || undefined,
        status: form.status,
      };
      if (editingId) {
        await apiFetch(`/hotel-extra-reservations/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/hotel-extra-reservations", { method: "POST", body: JSON.stringify(body) });
      }
      setShowForm(false);
      setEditingId(null);
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta reserva?")) return;
    try {
      await apiFetch(`/hotel-extra-reservations/${id}`, { method: "DELETE" });
      onDataChanged();
    } catch {
      /* ignore */
    }
  };

  const todayStr = toYMD(today);

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="surface rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={prevMonth}
              className="btn btn-ghost"
              style={{ padding: "6px 12px", borderRadius: "99px" }}
            >
              ‹
            </button>
            <h2 className="text-lg font-bold" style={{ minWidth: "160px", textAlign: "center" }}>
              {MONTHS[month]} {year}
            </h2>
            <button
              type="button"
              onClick={nextMonth}
              className="btn btn-ghost"
              style={{ padding: "6px 12px", borderRadius: "99px" }}
            >
              ›
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openCreate(selectedDay || undefined)}
          >
            + Nueva reserva
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS_SHORT.map((d) => (
            <div key={d} className="text-center" style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", opacity: 0.5, paddingBottom: "8px" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="py-16 text-center opacity-50">Cargando…</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayRes = dayMap[dayStr] || [];
              const isToday = dayStr === todayStr;
              const isSelected = dayStr === selectedDay;

              return (
                <button
                  key={dayStr}
                  type="button"
                  onClick={() => setSelectedDay(isSelected ? null : dayStr)}
                  style={{
                    borderRadius: "12px",
                    padding: "6px 4px",
                    minHeight: "64px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "3px",
                    border: isSelected
                      ? "2px solid var(--accent, #6366f1)"
                      : isToday
                      ? "2px solid rgba(99,102,241,0.35)"
                      : "2px solid transparent",
                    background: isSelected
                      ? "rgba(99,102,241,0.1)"
                      : isToday
                      ? "rgba(99,102,241,0.05)"
                      : "transparent",
                    cursor: "pointer",
                    transition: "all 120ms",
                  }}
                >
                  <span
                    style={{
                      width: "24px",
                      height: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      fontSize: "13px",
                      fontWeight: isToday ? 800 : 500,
                      background: isToday ? "var(--accent, #6366f1)" : "transparent",
                      color: isToday ? "#fff" : "inherit",
                    }}
                  >
                    {day}
                  </span>
                  {/* Reservation dots */}
                  {dayRes.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5" style={{ maxWidth: "100%" }}>
                      {dayRes.slice(0, 4).map((res) => {
                        const sc = STATUS_COLORS[res.status] ?? STATUS_COLORS.PENDING;
                        return (
                          <span
                            key={res.id}
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: sc.text,
                              flexShrink: 0,
                            }}
                          />
                        );
                      })}
                      {dayRes.length > 4 && (
                        <span style={{ fontSize: "8px", opacity: 0.6 }}>+{dayRes.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Status legend */}
        <div className="mt-4 flex flex-wrap gap-3">
          {Object.entries(STATUS_LABELS).map(([key, label]) => {
            const sc = STATUS_COLORS[key];
            return (
              <span key={key} className="flex items-center gap-1.5" style={{ fontSize: "11px", opacity: 0.75 }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: sc.text, display: "inline-block" }} />
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Selected day reservations */}
      {selectedDay && (
        <div className="surface rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base">
              Reservas del {parseDateLocal(selectedDay).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
            </h3>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: "13px", padding: "6px 14px" }}
              onClick={() => openCreate(selectedDay)}
            >
              + Nueva
            </button>
          </div>
          {selectedDayReservations.length === 0 ? (
            <p className="text-sm opacity-50 py-4 text-center">Sin reservas para este día.</p>
          ) : (
            <div className="space-y-2">
              {selectedDayReservations.map((res) => {
                const sc = STATUS_COLORS[res.status] ?? STATUS_COLORS.PENDING;
                const extraName = extras[res.extraId]?.name || res.extraId;
                const athleteName = athletes[res.participantId]?.fullName || res.participantId;
                return (
                  <div
                    key={res.id}
                    style={{
                      background: sc.bg,
                      border: `1px solid ${sc.border}`,
                      borderLeft: `4px solid ${sc.text}`,
                      borderRadius: "12px",
                      padding: "12px 14px",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{extraName}</p>
                        <p className="text-xs opacity-70 mt-0.5">{athleteName}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span style={{ fontSize: "11px", fontWeight: 700, color: sc.text }}>
                            {STATUS_LABELS[res.status] ?? res.status}
                          </span>
                          <span style={{ fontSize: "11px", opacity: 0.6 }}>
                            ×{res.quantity}
                          </span>
                          {res.startDate && res.endDate && (
                            <span style={{ fontSize: "11px", opacity: 0.6 }}>
                              {res.startDate} → {res.endDate}
                            </span>
                          )}
                          {res.notes && (
                            <span style={{ fontSize: "11px", opacity: 0.6 }} className="truncate max-w-xs">
                              {res.notes}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: "12px", padding: "4px 10px" }}
                          onClick={() => openEdit(res)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: "12px", padding: "4px 10px", color: "#ef4444" }}
                          onClick={() => handleDelete(res.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* All reservations without dates */}
      {(() => {
        const noDates = reservations.filter((r) => !r.startDate && !r.endDate);
        if (noDates.length === 0) return null;
        return (
          <div className="surface rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base opacity-70">Sin rango de fechas ({noDates.length})</h3>
            </div>
            <div className="space-y-2">
              {noDates.map((res) => {
                const sc = STATUS_COLORS[res.status] ?? STATUS_COLORS.PENDING;
                const extraName = extras[res.extraId]?.name || res.extraId;
                const athleteName = athletes[res.participantId]?.fullName || res.participantId;
                return (
                  <div
                    key={res.id}
                    style={{
                      background: sc.bg,
                      border: `1px solid ${sc.border}`,
                      borderLeft: `4px solid ${sc.text}`,
                      borderRadius: "12px",
                      padding: "12px 14px",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{extraName}</p>
                        <p className="text-xs opacity-70 mt-0.5">{athleteName}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span style={{ fontSize: "11px", fontWeight: 700, color: sc.text }}>
                            {STATUS_LABELS[res.status] ?? res.status}
                          </span>
                          <span style={{ fontSize: "11px", opacity: 0.6 }}>×{res.quantity}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: "12px", padding: "4px 10px" }}
                          onClick={() => openEdit(res)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: "12px", padding: "4px 10px", color: "#ef4444" }}
                          onClick={() => handleDelete(res.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Create / Edit modal */}
      {showForm && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div
            className="surface rounded-2xl p-6 w-full max-w-md space-y-4"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">{editingId ? "Editar reserva" : "Nueva reserva"}</h2>
              <button type="button" className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label-sm">Extra *</label>
                <select className="input w-full" value={form.extraId} onChange={(e) => setForm((f) => ({ ...f, extraId: e.target.value }))}>
                  <option value="">Seleccionar extra…</option>
                  {Object.values(extras).map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name || ex.id}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-sm">Participante *</label>
                <select className="input w-full" value={form.participantId} onChange={(e) => setForm((f) => ({ ...f, participantId: e.target.value }))}>
                  <option value="">Seleccionar participante…</option>
                  {Object.values(athletes).map((a) => (
                    <option key={a.id} value={a.id}>{a.fullName || a.id}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">Desde</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-sm">Hasta</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    className="input w-full"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-sm">Estado</label>
                  <select className="input w-full" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="PENDING">Pendiente</option>
                    <option value="APPROVED">Aprobado</option>
                    <option value="REJECTED">Rechazado</option>
                    <option value="DELIVERED">Entregado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label-sm">Notas</label>
                <input
                  type="text"
                  className="input w-full"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Observaciones opcionales"
                />
              </div>
            </div>

            {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" className="btn btn-ghost flex-1" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear reserva"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
