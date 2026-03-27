"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type MealType = "DESAYUNO" | "ALMUERZO" | "CENA";

type FoodMenu = {
  id: string;
  date: string;
  mealType: MealType;
  title: string;
  description?: string;
  dietaryType?: string;
  accommodationId?: string;
};

type Accommodation = { id: string; name: string };

const MEAL_META: Record<MealType, { label: string; icon: React.ReactNode }> = {
  DESAYUNO: { label: "Desayuno", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg> },
  ALMUERZO: { label: "Almuerzo", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
  CENA:     { label: "Cena",     icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
};

const DIETARY_OPTIONS = [
  { value: "",             label: "General (todos los tipos)" },
  { value: "ESTANDAR",    label: "Estándar" },
  { value: "VEGETARIANO", label: "Vegetariano" },
  { value: "VEGANO",      label: "Vegano" },
  { value: "SIN_GLUTEN",  label: "Sin gluten" },
  { value: "SIN_LACTOSA", label: "Sin lactosa" },
  { value: "HALAL",       label: "Halal" },
  { value: "KOSHER",      label: "Kosher" },
  { value: "SIN_MARISCOS",label: "Sin mariscos" },
  { value: "DIABETICO",   label: "Diabético" },
  { value: "OTRO",        label: "Otro" },
];

const DIETARY_BADGE: Record<string, string> = {
  ESTANDAR:    "bg-slate-100 text-slate-600 border-slate-200",
  VEGETARIANO: "bg-green-100 text-green-700 border-green-200",
  VEGANO:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  SIN_GLUTEN:  "bg-amber-100 text-amber-700 border-amber-200",
  SIN_LACTOSA: "bg-yellow-100 text-yellow-700 border-yellow-200",
  HALAL:       "bg-teal-100 text-teal-700 border-teal-200",
  KOSHER:      "bg-blue-100 text-blue-700 border-blue-200",
  SIN_MARISCOS:"bg-orange-100 text-orange-700 border-orange-200",
  DIABETICO:   "bg-red-100 text-red-700 border-red-200",
  OTRO:        "bg-purple-100 text-purple-700 border-purple-200",
};


function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatFullDate(ds: string, dateLocale: string) {
  return new Date(ds + "T12:00:00").toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long" });
}

function formatTodayLong(dateLocale: string) {
  return new Date().toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function dietaryLabel(key: string | undefined, t: (s: string) => string) {
  const opt = DIETARY_OPTIONS.find((o) => o.value === key);
  return opt ? t(opt.label) : key ?? "";
}

type FormState = { title: string; description: string; dietaryType: string; accommodationId: string };
const EMPTY: FormState = { title: "", description: "", dietaryType: "", accommodationId: "" };

// ─── Inline form fields ─────────────────────────────────────────────────────
function MenuFormFields({
  form, saving, editingId, accommodations, onChange, onSave, onCancel, t,
}: {
  form: FormState;
  saving: boolean;
  editingId: string | null;
  accommodations: Accommodation[];
  onChange: (patch: Partial<FormState>) => void;
  onSave: () => void;
  onCancel: () => void;
  t: (s: string) => string;
}) {
  const fieldStyle: React.CSSProperties = { width: "100%", height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#0f172a", fontSize: "13px", outline: "none" };
  const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: "4px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div>
        <label style={labelStyle}>{t("Tipo de alimentación")}</label>
        <select style={fieldStyle} value={form.dietaryType} onChange={(e) => onChange({ dietaryType: e.target.value })}>
          {DIETARY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>{t("Plato principal *")}</label>
        <input style={fieldStyle} placeholder="Ej: Pollo asado con ensalada" value={form.title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div>
        <label style={labelStyle}>{t("Descripción / acompañamientos")}</label>
        <textarea style={{ ...fieldStyle, height: "auto", padding: "8px 10px", resize: "none" }} rows={2} placeholder="Ej: Con papas al vapor y jugo" value={form.description} onChange={(e) => onChange({ description: e.target.value })} />
      </div>
      {accommodations.length > 0 && (
        <div>
          <label style={labelStyle}>{t("Hotel / Villa")}</label>
          <select style={fieldStyle} value={form.accommodationId} onChange={(e) => onChange({ accommodationId: e.target.value })}>
            <option value="">{t("Sin especificar")}</option>
            {accommodations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
        <button type="button" style={{ flex: 1, padding: "8px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#fff", border: "none", cursor: !form.title.trim() || saving ? "not-allowed" : "pointer", opacity: !form.title.trim() || saving ? 0.6 : 1 }} disabled={!form.title.trim() || saving} onClick={onSave}>
          {saving ? t("Guardando…") : editingId ? t("Guardar cambios") : t("Agregar plato")}
        </button>
        <button type="button" style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: "transparent", border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer" }} onClick={onCancel}>{t("Cancelar")}</button>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function FoodCalendar({ mealType }: { mealType: MealType }) {
  const { locale, t } = useI18n();
  const dateLocale = locale === "en" ? "en-US" : locale === "pt" ? "pt-BR" : "es-CL";
  const meta = MEAL_META[mealType];
  // Use local date (not UTC) so the banner matches the calendar cells and the user's clock
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [menus, setMenus] = useState<FoodMenu[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [filterAccomm, setFilterAccomm] = useState("");

  // Calendar panel
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [panelAdding, setPanelAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panelForm, setPanelForm] = useState<FormState>(EMPTY);
  const [panelSaving, setPanelSaving] = useState(false);

  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  const loadMenus = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month: monthStr });
      if (filterAccomm) params.set("accommodationId", filterAccomm);
      const data = await apiFetch<FoodMenu[]>(`/food-menus?${params}`);
      setMenus((data ?? []).filter((m) => m.mealType === mealType));
    } finally {
      setLoading(false);
    }
  }, [monthStr, filterAccomm, mealType]);

  useEffect(() => { loadMenus(); }, [loadMenus]);
  useEffect(() => { apiFetch<Accommodation[]>("/accommodations").then((d) => setAccommodations(d ?? [])); }, []);

  // Grid
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const d = i - startPad + 1;
    return d >= 1 && d <= daysInMonth ? d : null;
  });

  const menusByDate = menus.reduce<Record<string, FoodMenu[]>>((acc, m) => {
    const k = m.date.slice(0, 10);
    (acc[k] ??= []).push(m);
    return acc;
  }, {});

  const todayMenus  = menusByDate[today] ?? [];
  const panelMenus  = selectedDay ? (menusByDate[selectedDay] ?? []) : [];

  // ── Actions ──
  function selectDay(ds: string) {
    setSelectedDay(ds);
    setPanelAdding(false);
    setEditingId(null);
    setPanelForm(EMPTY);
  }

  function startEdit(m: FoodMenu) {
    setEditingId(m.id);
    setPanelForm({ title: m.title, description: m.description ?? "", dietaryType: m.dietaryType ?? "", accommodationId: m.accommodationId ?? "" });
    setPanelAdding(true);
  }

  async function submitPanel() {
    if (!panelForm.title.trim() || !selectedDay) return;
    setPanelSaving(true);
    const payload = { date: selectedDay, mealType, title: panelForm.title.trim(), description: panelForm.description.trim() || undefined, dietaryType: panelForm.dietaryType || undefined, accommodationId: panelForm.accommodationId || undefined };
    try {
      if (editingId) {
        await apiFetch(`/food-menus/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await apiFetch("/food-menus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setPanelAdding(false);
      setEditingId(null);
      setPanelForm(EMPTY);
      await loadMenus();
    } finally { setPanelSaving(false); }
  }

  async function handleDelete(id: string) {
    await apiFetch(`/food-menus/${id}`, { method: "DELETE" });
    await loadMenus();
  }

  // ── Render ──
  return (
    <div className="space-y-4">

      {/* TODAY BANNER */}
      <div style={{ borderRadius: "20px", background: "#ffffff", border: "1px solid #e2e8f0", padding: "24px 28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "3px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#21D0B3" }}>
              <span style={{ color: "#21D0B3", display: "flex" }}>{meta.icon}</span>
              {t(meta.label)} de hoy
            </span>
            <p style={{ marginTop: "8px", fontSize: "14px", fontWeight: 600, color: "#64748b", textTransform: "capitalize" }}>{formatTodayLong(dateLocale)}</p>
          </div>
        </div>

        {todayMenus.length > 0 ? (
          <div style={{ marginTop: "20px", display: "flex", flexWrap: "wrap", gap: "16px" }}>
            {todayMenus.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#21D0B3", marginTop: "10px", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>{m.title}</p>
                  {m.dietaryType && (
                    <span style={{ display: "inline-block", fontSize: "10px", fontWeight: 700, background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", padding: "2px 10px", borderRadius: "99px", marginTop: "4px", color: "#21D0B3" }}>
                      {dietaryLabel(m.dietaryType, t)}
                    </span>
                  )}
                  {m.description && <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>{m.description}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ marginTop: "16px", fontSize: "28px", fontWeight: 800, color: "#cbd5e1" }}>{t("Sin menú configurado")}</p>
        )}

        <p style={{ marginTop: "16px", fontSize: "11px", color: "#94a3b8" }}>
          {t("Selecciona el día de hoy en el calendario para agregar o editar platos.")}
        </p>
      </div>

      {/* CALENDAR HEADER */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "12px 16px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button type="button" onClick={() => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); }} style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span style={{ fontSize: "17px", fontWeight: 700, color: "#0f172a", width: "210px", textAlign: "center", userSelect: "none", textTransform: "capitalize" }}>{new Date(year, month, 1).toLocaleDateString(dateLocale, { month: "long" })} {year}</span>
          <button type="button" onClick={() => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); }} style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
        {accommodations.length > 0 && (
          <select style={{ height: "36px", padding: "0 12px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#0f172a", fontSize: "13px", outline: "none", marginLeft: "auto" }} value={filterAccomm} onChange={(e) => setFilterAccomm(e.target.value)}>
            <option value="">{t("Todos los hoteles")}</option>
            {accommodations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>

      {/* GRID + PANEL */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", alignItems: "start" }}>

        {/* Calendar grid */}
        <div style={{ gridColumn: "span 2", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #f1f5f9" }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date(2021, 0, 4 + i);
              return (
                <div key={i} style={{ textAlign: "center", fontSize: "10px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", padding: "8px 0", letterSpacing: "0.08em" }}>
                  {d.toLocaleDateString(dateLocale, { weekday: "short" })}
                </div>
              );
            })}
          </div>
          {loading ? (
            <div style={{ height: "256px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#94a3b8" }}>{t("Cargando...")}</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} style={{ minHeight: "88px", background: "#f8fafc", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }} />;
                const ds = toISO(year, month, day);
                const dayMenus = menusByDate[ds] ?? [];
                const isSelected = selectedDay === ds;
                const isToday = ds === today;
                return (
                  <button key={i} type="button" onClick={() => selectDay(ds)}
                    style={{
                      minHeight: "88px", padding: "6px", textAlign: "left", display: "flex", flexDirection: "column", gap: "4px", width: "100%", cursor: "pointer",
                      background: isSelected ? "rgba(33,208,179,0.06)" : "transparent",
                      outline: isSelected ? "2px solid #21D0B3" : "none",
                      outlineOffset: "-2px",
                      border: "none",
                      borderRight: "1px solid #f1f5f9",
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background 120ms",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span style={{
                      fontSize: "12px", fontWeight: 700, alignSelf: "flex-end", borderRadius: "50%",
                      width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center",
                      background: isToday ? "#21D0B3" : "transparent",
                      color: isToday ? "#ffffff" : isSelected ? "#21D0B3" : "#64748b",
                    }}>
                      {day}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%", minWidth: 0 }}>
                      {dayMenus.map((m) => (
                        <span key={m.id} style={{ fontSize: "9px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "1px 4px", borderRadius: "4px", border: "1px solid rgba(33,208,179,0.25)", background: "rgba(33,208,179,0.08)", fontWeight: 600, color: "#21D0B3" }}>
                          {m.title}{m.dietaryType ? ` · ${dietaryLabel(m.dietaryType, t)}` : ""}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Day detail panel */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "16px", minHeight: "300px" }}>
          {!selectedDay ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", textAlign: "center", padding: "40px 0" }}>
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#e2e8f0" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              <p style={{ fontSize: "13px", color: "#94a3b8" }}>{t("Selecciona un día del calendario")}</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "#21D0B3" }}>{t(meta.label)}</p>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", textTransform: "capitalize", marginTop: "2px" }}>{formatFullDate(selectedDay, dateLocale)}</h3>
                </div>
                {!panelAdding && (
                  <button type="button" style={{ padding: "5px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#fff", border: "none", cursor: "pointer", flexShrink: 0 }} onClick={() => { setEditingId(null); setPanelForm(EMPTY); setPanelAdding(true); }}>
                    {t("+ Agregar")}
                  </button>
                )}
              </div>

              {!panelAdding && panelMenus.length === 0 && (
                <p style={{ fontSize: "13px", color: "#94a3b8" }}>{t("Sin menús para este día.")}</p>
              )}

              {panelMenus.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {panelMenus.map((m) => (
                    <div key={m.id} style={{ borderRadius: "10px", padding: "12px", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "4px" }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{m.title}</p>
                          {m.dietaryType && (
                            <span style={{ display: "inline-block", fontSize: "10px", fontWeight: 600, padding: "1px 8px", borderRadius: "99px", border: "1px solid rgba(33,208,179,0.25)", background: "rgba(33,208,179,0.08)", color: "#21D0B3", marginTop: "4px" }}>
                              {dietaryLabel(m.dietaryType, t)}
                            </span>
                          )}
                          {m.description && <p style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{m.description}</p>}
                        </div>
                        <div style={{ display: "flex", gap: "8px", flexShrink: 0, marginTop: "2px" }}>
                          <button type="button" onClick={() => startEdit(m)} style={{ fontSize: "11px", color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>{t("editar")}</button>
                          <button type="button" onClick={() => handleDelete(m.id)} style={{ fontSize: "11px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>{t("borrar")}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {panelAdding && (
                <div style={{ borderRadius: "10px", border: "1px solid #e2e8f0", background: "#ffffff", padding: "16px" }}>
                  <p style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: "12px" }}>
                    {editingId ? t("Editar plato") : `${t("Nuevo plato")} — ${t(meta.label)}`}
                  </p>
                  <MenuFormFields
                    form={panelForm}
                    saving={panelSaving}
                    editingId={editingId}
                    accommodations={accommodations}
                    onChange={(p) => setPanelForm((f) => ({ ...f, ...p }))}
                    onSave={submitPanel}
                    onCancel={() => { setPanelAdding(false); setEditingId(null); setPanelForm(EMPTY); }}
                    t={t}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
