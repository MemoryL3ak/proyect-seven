"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useTheme } from "@/lib/theme";

type EventExpectedCapacity = {
  disciplineId: string;
  delegationCode: string;
  expectedCount: number;
};

type EventItem = {
  id: string;
  name?: string | null;
  expectedCapacities?: EventExpectedCapacity[];
};

type Discipline = {
  id: string;
  eventId?: string | null;
  name?: string | null;
  category?: string | null;
  gender?: string | null;
};

type Delegation = {
  id: string;
  eventId?: string | null;
  countryCode?: string | null;
};

type Athlete = {
  id: string;
  eventId?: string | null;
  delegationId?: string | null;
  disciplineId?: string | null;
};

type QuotaState = Record<string, string>;

type PlanningRow = {
  key: string;
  delegationId: string;
  delegationCode: string;
  disciplineId: string;
  disciplineName: string;
  category: string;
  gender: string;
  andCount: number;
};

const CATEGORY_OPTIONS = [
  { label: "Todos los tipos", value: "" },
  { label: "Convencional", value: "CONVENTIONAL" },
  { label: "Paralímpica", value: "PARALYMPIC" },
];

const GENDER_OPTIONS = [
  { label: "Todos los géneros", value: "" },
  { label: "Masculino", value: "MALE" },
  { label: "Femenino", value: "FEMALE" },
  { label: "Mixto", value: "MIXED" },
];

function categoryLabel(value?: string | null) {
  if (!value) return "-";
  if (value === "CONVENTIONAL") return "Convencional";
  if (value === "PARALYMPIC") return "Paralímpica";
  return value;
}

function genderLabel(value?: string | null) {
  if (!value) return "-";
  const normalized = value.trim().toUpperCase();
  if (normalized === "MALE" || normalized === "M") return "Masculino";
  if (normalized === "FEMALE" || normalized === "F") return "Femenino";
  if (normalized === "MIXED" || normalized === "X") return "Mixto";
  return value;
}

function quotaKey(delegationCode: string, disciplineId: string) {
  return `${delegationCode}::${disciplineId}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  CONVENTIONAL: "#38bdf8",
  PARALYMPIC: "#a78bfa",
};
const GENDER_COLORS: Record<string, string> = {
  MALE: "#60a5fa", FEMALE: "#f472b6", MIXED: "#34d399",
  M: "#60a5fa", F: "#f472b6", X: "#34d399",
};

export default function DeportesPage() {
  const { theme } = useTheme();
  const isObsidian = theme === "obsidian";
  const isAtlas = theme === "atlas";
  const isDark = theme === "dark";

  const pal = isObsidian ? {
    panelBg: "linear-gradient(135deg, #0a1322 0%, #0e1728 60%, #0d1a30 100%)",
    panelBorder: "rgba(34,211,238,0.08)", panelShadow: "0 4px 32px rgba(0,0,0,0.6)",
    orb1: "rgba(56,189,248,0.08)", orb2: "rgba(168,85,247,0.07)",
    accent: "#22d3ee", titleColor: "#e2e8f0", subtitleColor: "rgba(255,255,255,0.45)",
    cardShadow: "0 4px 20px rgba(0,0,0,0.5)",
    labelColor: "rgba(255,255,255,0.35)", textMuted: "rgba(255,255,255,0.5)",
    inputBg: "rgba(255,255,255,0.06)", inputColor: "#e2e8f0",
    kpi: ["#22d3ee", "#10b981", "#f59e0b"],
  } : isDark ? {
    panelBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #111827 100%)",
    panelBorder: "rgba(255,255,255,0.06)", panelShadow: "0 4px 24px rgba(0,0,0,0.45)",
    orb1: "rgba(56,189,248,0.07)", orb2: "rgba(129,140,248,0.06)",
    accent: "#38bdf8", titleColor: "#f1f5f9", subtitleColor: "rgba(255,255,255,0.4)",
    cardShadow: "0 2px 12px rgba(0,0,0,0.3)",
    labelColor: "var(--text-faint)", textMuted: "var(--text-muted)",
    inputBg: "rgba(255,255,255,0.07)", inputColor: "#f1f5f9",
    kpi: ["#38bdf8", "#10b981", "#f59e0b"],
  } : isAtlas ? {
    panelBg: "linear-gradient(135deg, #ffffff 0%, #f0f4ff 60%, #eef1f8 100%)",
    panelBorder: "#c7d2fe", panelShadow: "0 1px 4px rgba(0,0,0,0.07)",
    orb1: "rgba(59,91,219,0.06)", orb2: "rgba(100,129,240,0.05)",
    accent: "#3b5bdb", titleColor: "#0f172a", subtitleColor: "#64748b",
    cardShadow: "0 1px 4px rgba(0,0,0,0.06)",
    labelColor: "#94a3b8", textMuted: "#64748b",
    inputBg: "#ffffff", inputColor: "#0f172a",
    kpi: ["#3b5bdb", "#10b981", "#f59e0b"],
  } : {
    panelBg: "linear-gradient(135deg, #ffffff 0%, #f8fafc 60%, #f1f5f9 100%)",
    panelBorder: "#e2e8f0", panelShadow: "0 1px 4px rgba(0,0,0,0.06)",
    orb1: "rgba(56,189,248,0.05)", orb2: "rgba(124,58,237,0.04)",
    accent: "#1e3a8a", titleColor: "#0f172a", subtitleColor: "#64748b",
    cardShadow: "0 1px 3px rgba(0,0,0,0.05)",
    labelColor: "#94a3b8", textMuted: "#64748b",
    inputBg: "#ffffff", inputColor: "#0f172a",
    kpi: ["#1e3a8a", "#10b981", "#f59e0b"],
  };

  const [events, setEvents] = useState<EventItem[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedDelegationId, setSelectedDelegationId] = useState("");
  const [selectedDisciplineId, setSelectedDisciplineId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [quotas, setQuotas] = useState<QuotaState>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventData, disciplineData, delegationData, athleteData] = await Promise.all([
        apiFetch<EventItem[]>("/events"),
        apiFetch<Discipline[]>("/disciplines"),
        apiFetch<Delegation[]>("/delegations"),
        apiFetch<Athlete[]>("/athletes"),
      ]);
      const safeEvents = Array.isArray(eventData) ? eventData : [];
      setEvents(safeEvents);
      setDisciplines(Array.isArray(disciplineData) ? disciplineData : []);
      setDelegations(Array.isArray(delegationData) ? delegationData : []);
      setAthletes(filterValidatedAthletes(Array.isArray(athleteData) ? athleteData : []));
      if (!selectedEventId && safeEvents.length > 0) setSelectedEventId(safeEvents[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar planificación deportiva");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === selectedEventId) || null,
    [events, selectedEventId],
  );

  const eventDisciplines = useMemo(
    () => disciplines.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true)),
    [disciplines, selectedEventId],
  );

  const eventDelegations = useMemo(
    () => delegations.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true)),
    [delegations, selectedEventId],
  );

  const eventAthletes = useMemo(
    () => athletes.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true)),
    [athletes, selectedEventId],
  );

  useEffect(() => {
    setSelectedDelegationId("");
    setSelectedDisciplineId("");
    setSelectedCategory("");
    setSelectedGender("");
    setPage(1);
    setMessage(null);
  }, [selectedEventId]);

  useEffect(() => {
    const next: QuotaState = {};
    (selectedEvent?.expectedCapacities || []).forEach((row) => {
      next[quotaKey(row.delegationCode.trim().toUpperCase(), row.disciplineId)] = String(
        Math.max(0, Number(row.expectedCount || 0)),
      );
    });
    setQuotas(next);
  }, [selectedEvent]);

  const allRows = useMemo(() => {
    const disciplineMap = new Map(eventDisciplines.map((item) => [item.id, item]));
    const delegationMap = new Map(eventDelegations.map((item) => [item.id, item]));
    const andCounts = new Map<string, number>();

    eventAthletes.forEach((athlete) => {
      const delegation = athlete.delegationId ? delegationMap.get(athlete.delegationId) : null;
      const discipline = athlete.disciplineId ? disciplineMap.get(athlete.disciplineId) : null;
      const delegationCode = String(delegation?.countryCode || "").trim().toUpperCase();
      if (!delegationCode || !athlete.disciplineId || !discipline) return;
      const key = quotaKey(delegationCode, athlete.disciplineId);
      andCounts.set(key, (andCounts.get(key) ?? 0) + 1);
    });

    return eventDelegations
      .flatMap((delegation) => {
        const delegationCode = String(delegation.countryCode || "").trim().toUpperCase();
        if (!delegationCode) return [] as PlanningRow[];
        return eventDisciplines.map((discipline) => {
          const key = quotaKey(delegationCode, discipline.id);
          return {
            key, delegationId: delegation.id, delegationCode,
            disciplineId: discipline.id, disciplineName: discipline.name || discipline.id,
            category: discipline.category || "", gender: discipline.gender || "",
            andCount: andCounts.get(key) ?? 0,
          } satisfies PlanningRow;
        });
      })
      .sort((a, b) => {
        const byDelegation = a.delegationCode.localeCompare(b.delegationCode);
        if (byDelegation !== 0) return byDelegation;
        const byDiscipline = a.disciplineName.localeCompare(b.disciplineName);
        if (byDiscipline !== 0) return byDiscipline;
        const byCategory = categoryLabel(a.category).localeCompare(categoryLabel(b.category));
        if (byCategory !== 0) return byCategory;
        return genderLabel(a.gender).localeCompare(genderLabel(b.gender));
      });
  }, [eventAthletes, eventDelegations, eventDisciplines]);

  const filteredRows = useMemo(
    () => allRows.filter((row) => {
      if (selectedDelegationId && row.delegationId !== selectedDelegationId) return false;
      if (selectedDisciplineId && row.disciplineId !== selectedDisciplineId) return false;
      if (selectedCategory && row.category !== selectedCategory) return false;
      if (selectedGender && row.gender !== selectedGender) return false;
      return true;
    }),
    [allRows, selectedDelegationId, selectedDisciplineId, selectedCategory, selectedGender],
  );

  useEffect(() => { setPage(1); }, [selectedDelegationId, selectedDisciplineId, selectedCategory, selectedGender]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / pageSize)), [filteredRows.length]);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const visibleQuotaTotal = useMemo(
    () => filteredRows.reduce((sum, row) => {
      const current = Number(quotas[row.key] || "0");
      return sum + (Number.isFinite(current) ? Math.max(0, current) : 0);
    }, 0),
    [filteredRows, quotas],
  );

  const configuredRows = useMemo(
    () => filteredRows.filter((row) => Math.max(0, Math.floor(Number(quotas[row.key] || "0"))) > 0).length,
    [filteredRows, quotas],
  );

  const saveQuotas = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const visibleKeys = new Set(filteredRows.map((row) => row.key));
      const untouched = (selectedEvent.expectedCapacities || []).filter((row) => {
        const key = quotaKey(row.delegationCode.trim().toUpperCase(), row.disciplineId);
        return !visibleKeys.has(key);
      });
      const updated = filteredRows.map((row) => ({
        disciplineId: row.disciplineId,
        delegationCode: row.delegationCode,
        expectedCount: Math.max(0, Math.floor(Number(quotas[row.key] || "0"))),
      }));
      await apiFetch(`/events/${selectedEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedCapacities: [...untouched, ...updated] }),
      });
      setMessage("Cupos guardados correctamente para las filas visibles.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los cupos");
    } finally {
      setSaving(false);
    }
  };

  const kpiCards = [
    { label: "Filas visibles",    value: filteredRows.length,  color: pal.kpi[0], icon: "📋", sub: "Combinaciones delegación × disciplina" },
    { label: "Cupo visible total", value: visibleQuotaTotal,   color: pal.kpi[1], icon: "🎯", sub: "Suma de cupos esperados" },
    { label: "Filas con cupo",    value: configuredRows,       color: pal.kpi[2], icon: "✅", sub: "Con cupo mayor a cero" },
  ];

  const selectStyle = { background: pal.inputBg, color: pal.inputColor };

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">

      {/* ── Command panel */}
      <section style={{ borderRadius: "24px", overflow: "hidden", boxShadow: pal.panelShadow }}>
        <div style={{ background: pal.panelBg, border: `1px solid ${pal.panelBorder}`, borderRadius: "24px", padding: "24px 28px 22px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-50px", right: "-30px", width: "240px", height: "240px", borderRadius: "50%", background: pal.orb1, filter: "blur(55px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-30px", left: "20%", width: "200px", height: "200px", borderRadius: "50%", background: pal.orb2, filter: "blur(45px)", pointerEvents: "none" }} />

          <div style={{ position: "relative" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.labelColor }}>Deportes</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "99px", padding: "2px 10px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#38bdf8", display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "#38bdf8" }}>EN VIVO</span>
              </span>
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: pal.titleColor, margin: "0 0 16px" }}>Planificación deportiva</h1>

            {/* Filters row 1 */}
            <div className="grid gap-3 lg:grid-cols-5" style={{ marginBottom: "10px" }}>
              <select className="input lg:col-span-2 rounded-2xl" style={selectStyle}
                value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                <option value="">Selecciona evento</option>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>)}
              </select>
              <select className="input rounded-2xl" style={selectStyle}
                value={selectedDelegationId} onChange={(e) => setSelectedDelegationId(e.target.value)}>
                <option value="">Todas las delegaciones</option>
                {eventDelegations.map((d) => <option key={d.id} value={d.id}>{d.countryCode || d.id}</option>)}
              </select>
              <select className="input rounded-2xl" style={selectStyle}
                value={selectedDisciplineId} onChange={(e) => setSelectedDisciplineId(e.target.value)}>
                <option value="">Todas las disciplinas</option>
                {eventDisciplines.map((d) => <option key={d.id} value={d.id}>{d.name || d.id}</option>)}
              </select>
              <select className="input rounded-2xl" style={selectStyle}
                value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((o) => <option key={o.value || "all"} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Filters row 2 */}
            <div className="grid gap-3 lg:grid-cols-4">
              <select className="input rounded-2xl" style={selectStyle}
                value={selectedGender} onChange={(e) => setSelectedGender(e.target.value)}>
                {GENDER_OPTIONS.map((o) => <option key={o.value || "all"} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* KPI mini-cards */}
            <div className="grid gap-3 lg:grid-cols-3" style={{ marginTop: "18px" }}>
              {kpiCards.map((card) => (
                <div key={card.label} style={{
                  background: (isObsidian || isDark) ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.65)",
                  border: `1px solid ${card.color}30`,
                  borderLeft: `3px solid ${card.color}`,
                  borderRadius: "14px", padding: "14px 18px",
                  display: "flex", alignItems: "center", gap: "14px",
                  transition: "transform 120ms ease",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                >
                  <span style={{ fontSize: "22px", lineHeight: 1, flexShrink: 0 }}>{card.icon}</span>
                  <div>
                    <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: card.color, marginBottom: "2px" }}>{card.label}</p>
                    <p style={{
                      fontSize: "1.8rem", fontWeight: 800, lineHeight: 1, color: card.color,
                      textShadow: (isObsidian || isDark) ? `0 0 16px ${card.color}44` : "none",
                    }}>{card.value}</p>
                    <p style={{ fontSize: "10px", color: pal.subtitleColor, marginTop: "2px" }}>{card.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination + save */}
            <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: "16px" }}>
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</button>
                <span style={{
                  background: (isObsidian || isDark) ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)",
                  border: `1px solid ${pal.panelBorder}`,
                  borderRadius: "99px", padding: "4px 14px",
                  fontSize: "12px", fontWeight: 600, color: pal.subtitleColor,
                }}>Página {page} de {totalPages}</span>
                <button className="btn btn-ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Siguiente</button>
              </div>
              <button className="btn btn-primary" onClick={saveQuotas} disabled={saving || !selectedEventId || filteredRows.length === 0}>
                {saving ? "Guardando..." : "Guardar cupos"}
              </button>
            </div>

            {message ? <p style={{ marginTop: "10px", fontSize: "13px", color: "#10b981", fontWeight: 600 }}>{message}</p> : null}
            {error ? <p style={{ marginTop: "10px", fontSize: "13px", color: "#ef4444" }}>{error}</p> : null}
          </div>
        </div>
      </section>

      {/* ── Table */}
      <section style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "24px", overflow: "hidden", boxShadow: pal.cardShadow,
      }}>
        {loading ? (
          <p style={{ padding: "24px", fontSize: "13px", color: "var(--text-muted)" }}>Cargando filas...</p>
        ) : filteredRows.length === 0 ? (
          <p style={{ padding: "24px", fontSize: "13px", color: "var(--text-muted)" }}>No hay filas para los filtros seleccionados.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "960px", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--elevated)" }}>
                  {["Delegación", "Disciplina", "Tipo", "Género", "AND", "Cupo esperado"].map((h) => (
                    <th key={h} style={{
                      padding: "13px 16px", textAlign: "left", fontSize: "10px",
                      fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
                      color: "var(--text-faint)", borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, idx) => {
                  const catColor = CATEGORY_COLORS[row.category] ?? "#94a3b8";
                  const genColor = GENDER_COLORS[row.gender.trim().toUpperCase()] ?? "#94a3b8";
                  return (
                    <tr key={row.key} style={{
                      background: idx % 2 === 0 ? "transparent" : "var(--elevated)",
                      borderBottom: "1px solid var(--border)",
                      transition: "background 100ms ease",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--elevated)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "transparent" : "var(--elevated)"; }}
                    >
                      <td style={{ padding: "11px 16px", fontWeight: 700, color: "var(--text)", letterSpacing: "0.04em" }}>{row.delegationCode}</td>
                      <td style={{ padding: "11px 16px", fontWeight: 600, color: "var(--text)" }}>{row.disciplineName}</td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{
                          background: `${catColor}18`, border: `1px solid ${catColor}35`,
                          borderRadius: "99px", padding: "3px 10px",
                          fontSize: "11px", fontWeight: 700, color: catColor,
                        }}>{categoryLabel(row.category)}</span>
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{
                          background: `${genColor}18`, border: `1px solid ${genColor}35`,
                          borderRadius: "99px", padding: "3px 10px",
                          fontSize: "11px", fontWeight: 700, color: genColor,
                        }}>{genderLabel(row.gender)}</span>
                      </td>
                      <td style={{ padding: "11px 16px", color: "var(--text)", fontWeight: 600 }}>{row.andCount}</td>
                      <td style={{ padding: "8px 16px" }}>
                        <input
                          className="input rounded-xl"
                          style={{ maxWidth: "120px", textAlign: "right", fontWeight: 700, background: "var(--elevated)", color: "var(--text)" }}
                          type="number" min={0} step={1}
                          value={quotas[row.key] ?? "0"}
                          onChange={(e) => setQuotas((prev) => ({ ...prev, [row.key]: e.target.value }))}
                        />
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
