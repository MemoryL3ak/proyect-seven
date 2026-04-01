"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import StyledSelect from "@/components/StyledSelect";

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
  parentId?: string | null;
  scheduledAt?: string | null;
  venueName?: string | null;
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

const EMPTY_PRUEBA = { name: "", category: "", gender: "", scheduledAt: "", venueName: "" };

const pal = {
  accent: "#21D0B3",
  titleColor: "#0f172a",
  subtitleColor: "#64748b",
  cardShadow: "0 1px 4px rgba(15,23,42,0.06)",
  labelColor: "#94a3b8",
  kpi: ["#21D0B3", "#10b981", "#f59e0b"] as [string, string, string],
};

const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: "10px",
  border: "1px solid #e2e8f0", background: "#f8fafc",
  fontSize: "14px", color: "#0f172a", outline: "none",
};

// ── KPI icons
const GridIcon = ({ color, size = 20 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const TargetIcon = ({ color, size = 20 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const CheckSquareIcon = ({ color, size = 20 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);

const ghostBtn: React.CSSProperties = {
  padding: "7px 14px", borderRadius: "10px", border: "1px solid #e2e8f0",
  background: "#ffffff", color: "#64748b", fontWeight: 600, fontSize: "13px",
  cursor: "pointer",
};
const primaryBtn: React.CSSProperties = {
  padding: "9px 20px", borderRadius: "10px", border: "none",
  background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#ffffff",
  fontWeight: 700, fontSize: "13px", cursor: "pointer",
  boxShadow: "0 2px 8px rgba(33,208,179,0.3)",
};

export default function DeportesPage() {
  const { t } = useI18n();

  // ── Data
  const [events, setEvents] = useState<EventItem[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [venueOptions, setVenueOptions] = useState<{ id: string; name: string; address?: string | null; eventId?: string | null }[]>([]);

  // ── UI state
  const [tab, setTab] = useState<"cupos" | "pruebas" | "calendario">("cupos");
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

  // ── Pruebas tab state
  const [focusDisciplineId, setFocusDisciplineId] = useState<string>("");
  const [expandedPruebas, setExpandedPruebas] = useState<Set<string>>(new Set());
  const [pruebaSearch, setPruebaSearch] = useState("");
  const [pruebaFilterCategory, setPruebaFilterCategory] = useState("");
  const [pruebaFilterGender, setPruebaFilterGender] = useState("");
  const [pruebaModal, setPruebaModal] = useState<null | { editing?: Discipline; parentId: string }>(null);
  const [pruebaForm, setPruebaForm] = useState(EMPTY_PRUEBA);
  const [pruebaSaving, setPruebaSaving] = useState(false);
  const [pruebaError, setPruebaError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventData, disciplineData, delegationData, athleteData, venueData] = await Promise.all([
        apiFetch<EventItem[]>("/events"),
        apiFetch<Discipline[]>("/disciplines"),
        apiFetch<Delegation[]>("/delegations"),
        apiFetch<Athlete[]>("/athletes"),
        apiFetch<{ id: string; name: string; address?: string | null; eventId?: string | null }[]>("/venues"),
      ]);
      const safeEvents = Array.isArray(eventData) ? eventData : [];
      setEvents(safeEvents);
      setDisciplines(Array.isArray(disciplineData) ? disciplineData : []);
      setDelegations(Array.isArray(delegationData) ? delegationData : []);
      setAthletes(filterValidatedAthletes(Array.isArray(athleteData) ? athleteData : []));
      setVenueOptions(Array.isArray(venueData) ? venueData : []);
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
    () => disciplines.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true) && !item.parentId),
    [disciplines, selectedEventId],
  );

  const pruebasOf = (disciplineId: string) =>
    disciplines.filter(d => d.parentId === disciplineId);

  const filteredDisciplines = useMemo(() => {
    const q = pruebaSearch.trim().toLowerCase();
    return eventDisciplines.filter(d => {
      if (q && !d.name?.toLowerCase().includes(q)) return false;
      if (pruebaFilterCategory && d.category !== pruebaFilterCategory) return false;
      if (pruebaFilterGender && d.gender !== pruebaFilterGender) return false;
      return true;
    });
  }, [eventDisciplines, pruebaSearch, pruebaFilterCategory, pruebaFilterGender]);

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

  const goToPruebas = (disciplineId: string) => {
    setFocusDisciplineId(disciplineId);
    setExpandedPruebas(new Set([disciplineId]));
    setTab("pruebas");
  };

  const togglePruebas = (id: string) =>
    setExpandedPruebas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const openAddPrueba = (parentId: string) => {
    setPruebaForm(EMPTY_PRUEBA);
    setPruebaError(null);
    setPruebaModal({ parentId });
  };

  const openEditPrueba = (d: Discipline) => {
    setPruebaForm({
      name: d.name ?? "",
      category: d.category ?? "",
      gender: d.gender ?? "",
      scheduledAt: d.scheduledAt ? d.scheduledAt.slice(0, 16) : "",
      venueName: d.venueName ?? "",
    });
    setPruebaError(null);
    setPruebaModal({ editing: d, parentId: d.parentId! });
  };

  const savePrueba = async () => {
    if (!pruebaForm.name.trim()) { setPruebaError("El nombre es requerido."); return; }
    setPruebaSaving(true);
    setPruebaError(null);
    try {
      const body = {
        name: pruebaForm.name.trim(),
        category: pruebaForm.category || null,
        gender: pruebaForm.gender || null,
        parentId: pruebaModal!.parentId,
        eventId: selectedEventId || null,
        scheduledAt: pruebaForm.scheduledAt ? new Date(pruebaForm.scheduledAt).toISOString() : null,
        venueName: pruebaForm.venueName || null,
      };
      if (pruebaModal?.editing) {
        await apiFetch(`/disciplines/${pruebaModal.editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/disciplines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      setPruebaModal(null);
      await load();
    } catch (e) {
      setPruebaError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setPruebaSaving(false);
    }
  };

  const removePrueba = async (d: Discipline) => {
    if (!confirm(`¿Eliminar la prueba "${d.name}"?`)) return;
    try {
      await apiFetch(`/disciplines/${d.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const kpiCards = [
    { label: t("Filas visibles"),    value: filteredRows.length,  color: pal.kpi[0], icon: "grid",   sub: t("Combinaciones delegación × disciplina") },
    { label: t("Cupo visible total"), value: visibleQuotaTotal,   color: pal.kpi[1], icon: "target", sub: t("Suma de cupos esperados") },
    { label: t("Filas con cupo"),    value: configuredRows,       color: pal.kpi[2], icon: "check",  sub: t("Con cupo mayor a cero") },
  ];

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">

      {/* ── Header */}
      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "24px 28px 22px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>{t("Deportes")}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "2px 10px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#21D0B3", display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "#21D0B3" }}>EN VIVO</span>
          </span>
        </div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: pal.titleColor, margin: "0 0 16px" }}>{t("Planificación deportiva")}</h1>

        {/* Event selector */}
        <div className="grid gap-3 lg:grid-cols-5" style={{ marginBottom: "16px" }}>
          <StyledSelect wrapperStyle={{ gridColumn: "span 2" }}
            value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
            <option value="">{t("Selecciona evento")}</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>)}
          </StyledSelect>
        </div>

        {/* Tabs */}
        <div style={{ background: "#f1f5f9", borderRadius: "12px", padding: "4px", width: "fit-content", display: "flex", gap: "4px" }}>
          {([["cupos", t("Cupos")], ["pruebas", t("Pruebas")], ["calendario", t("Calendario")]] as const).map(([tabKey, label]) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              style={{
                padding: "7px 20px", borderRadius: "9px", fontSize: "13px", fontWeight: 700,
                letterSpacing: "0.04em", border: "none", cursor: "pointer",
                transition: "all 150ms ease",
                background: tab === tabKey ? "linear-gradient(135deg, #21D0B3, #14AE98)" : "transparent",
                color: tab === tabKey ? "#ffffff" : "#64748b",
                boxShadow: tab === tabKey ? "0 2px 8px rgba(33,208,179,0.3)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Cupos filters */}
        {tab === "cupos" && (
          <>
            <div className="grid gap-3 lg:grid-cols-4" style={{ marginTop: "14px" }}>
              <StyledSelect value={selectedDelegationId} onChange={(e) => setSelectedDelegationId(e.target.value)}>
                <option value="">{t("Todas las delegaciones")}</option>
                {eventDelegations.map((d) => <option key={d.id} value={d.id}>{d.countryCode || d.id}</option>)}
              </StyledSelect>
              <StyledSelect value={selectedDisciplineId} onChange={(e) => setSelectedDisciplineId(e.target.value)}>
                <option value="">{t("Todas las disciplinas")}</option>
                {eventDisciplines.map((d) => <option key={d.id} value={d.id}>{d.name || d.id}</option>)}
              </StyledSelect>
              <StyledSelect value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((o) => <option key={o.value || "all"} value={o.value}>{t(o.label)}</option>)}
              </StyledSelect>
              <StyledSelect value={selectedGender} onChange={(e) => setSelectedGender(e.target.value)}>
                {GENDER_OPTIONS.map((o) => <option key={o.value || "all"} value={o.value}>{t(o.label)}</option>)}
              </StyledSelect>
            </div>

            {/* KPI mini-cards */}
            <div className="grid gap-3 lg:grid-cols-3" style={{ marginTop: "18px" }}>
              {kpiCards.map((card) => (
                <div key={card.label} style={{
                  background: "#ffffff", border: `1px solid ${card.color}30`,
                  borderLeft: `3px solid ${card.color}`, borderRadius: "14px",
                  padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px",
                  transition: "transform 120ms ease",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                >
                  {card.icon === "grid"   && <GridIcon color={card.color} size={22} />}
                  {card.icon === "target" && <TargetIcon color={card.color} size={22} />}
                  {card.icon === "check"  && <CheckSquareIcon color={card.color} size={22} />}
                  <div>
                    <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: card.color, marginBottom: "2px" }}>{card.label}</p>
                    <p style={{ fontSize: "1.8rem", fontWeight: 800, lineHeight: 1, color: card.color }}>{card.value}</p>
                    <p style={{ fontSize: "10px", color: pal.subtitleColor, marginTop: "2px" }}>{card.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination + save */}
            <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button style={{ ...ghostBtn, opacity: page <= 1 ? 0.5 : 1 }} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>{t("Anterior")}</button>
                <span style={{
                  background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "99px",
                  padding: "4px 14px", fontSize: "12px", fontWeight: 600, color: "#64748b",
                }}>{t("Página {p} de {total}").replace("{p}", String(page)).replace("{total}", String(totalPages))}</span>
                <button style={{ ...ghostBtn, opacity: page >= totalPages ? 0.5 : 1 }} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>{t("Siguiente")}</button>
              </div>
              <button style={{ ...primaryBtn, opacity: saving || !selectedEventId || filteredRows.length === 0 ? 0.6 : 1, cursor: saving || !selectedEventId || filteredRows.length === 0 ? "not-allowed" : "pointer" }} onClick={saveQuotas} disabled={saving || !selectedEventId || filteredRows.length === 0}>
                {saving ? t("Guardando...") : t("Guardar cupos")}
              </button>
            </div>

            {message ? <p style={{ marginTop: "10px", fontSize: "13px", color: "#21D0B3", fontWeight: 600 }}>{message}</p> : null}
            {error ? <p style={{ marginTop: "10px", fontSize: "13px", color: "#ef4444" }}>{error}</p> : null}
          </>
        )}

        {tab === "pruebas" && (
          <div style={{ marginTop: "14px" }} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                style={fieldStyle}
                placeholder={t("Buscar disciplina…")}
                value={pruebaSearch}
                onChange={e => setPruebaSearch(e.target.value)}
              />
              <StyledSelect value={pruebaFilterCategory} onChange={e => setPruebaFilterCategory(e.target.value)}>
                <option value="">{t("Todas las categorías")}</option>
                <option value="CONVENTIONAL">{t("Convencional")}</option>
                <option value="PARALYMPIC">{t("Paralímpica")}</option>
              </StyledSelect>
              <StyledSelect value={pruebaFilterGender} onChange={e => setPruebaFilterGender(e.target.value)}>
                <option value="">{t("Todos los géneros")}</option>
                <option value="MALE">{t("Masculino")}</option>
                <option value="FEMALE">{t("Femenino")}</option>
                <option value="MIXED">{t("Mixto")}</option>
              </StyledSelect>
            </div>
            <p style={{ fontSize: "12px", color: pal.subtitleColor }}>
              {filteredDisciplines.length} {filteredDisciplines.length === 1 ? t("disciplina") : t("disciplinas")} · {t("Clic en una disciplina para expandir sus pruebas · Clic en el nombre en la pestaña Cupos para ir directamente")}
            </p>
          </div>
        )}
      </section>

      {/* ── Cupos table */}
      {tab === "cupos" && (
        <section style={{
          background: "#ffffff", border: "1px solid #e2e8f0",
          borderRadius: "20px", overflow: "hidden", boxShadow: pal.cardShadow,
        }}>
          {loading ? (
            <p style={{ padding: "24px", fontSize: "13px", color: "#64748b" }}>{t("Cargando filas...")}</p>
          ) : filteredRows.length === 0 ? (
            <p style={{ padding: "24px", fontSize: "13px", color: "#94a3b8" }}>{t("No hay filas para los filtros seleccionados.")}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: "960px", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[t("Delegación"), t("Disciplina"), t("Tipo"), t("Género"), "AND", t("Cupo esperado")].map((h) => (
                      <th key={h} style={{
                        padding: "13px 16px", textAlign: "left", fontSize: "10px",
                        fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
                        color: "#94a3b8", borderBottom: "1px solid #e2e8f0",
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
                        background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                        borderBottom: "1px solid #e2e8f0", transition: "background 100ms ease",
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f1f5f9"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "#ffffff" : "#f8fafc"; }}
                      >
                        <td style={{ padding: "11px 16px", fontWeight: 700, color: "#0f172a", letterSpacing: "0.04em" }}>{row.delegationCode}</td>
                        <td style={{ padding: "11px 16px" }}>
                          <button
                            onClick={() => goToPruebas(row.disciplineId)}
                            style={{
                              fontWeight: 600, color: pal.accent, background: "none", border: "none",
                              cursor: "pointer", padding: 0, textDecoration: "underline", textDecorationStyle: "dotted",
                              textUnderlineOffset: "3px", fontSize: "13px",
                            }}
                            title="Ver pruebas de esta disciplina"
                          >
                            {row.disciplineName}
                          </button>
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          <span style={{
                            background: `${catColor}18`, border: `1px solid ${catColor}35`,
                            borderRadius: "99px", padding: "3px 10px",
                            fontSize: "11px", fontWeight: 700, color: catColor,
                          }}>{t(categoryLabel(row.category))}</span>
                        </td>
                        <td style={{ padding: "11px 16px" }}>
                          <span style={{
                            background: `${genColor}18`, border: `1px solid ${genColor}35`,
                            borderRadius: "99px", padding: "3px 10px",
                            fontSize: "11px", fontWeight: 700, color: genColor,
                          }}>{t(genderLabel(row.gender))}</span>
                        </td>
                        <td style={{ padding: "11px 16px", color: "#0f172a", fontWeight: 600 }}>{row.andCount}</td>
                        <td style={{ padding: "8px 16px" }}>
                          <input
                            style={{ ...fieldStyle, maxWidth: "120px", textAlign: "right", fontWeight: 700 }}
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
      )}

      {/* ── Pruebas tab */}
      {tab === "pruebas" && (
        <section style={{
          background: "#ffffff", border: "1px solid #e2e8f0",
          borderRadius: "20px", overflow: "hidden", boxShadow: pal.cardShadow,
        }}>
          <div style={{ overflowY: "auto", maxHeight: "560px" }}>
            {filteredDisciplines.length === 0 && (
              <div style={{ padding: "32px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
                {selectedEventId
                  ? pruebaSearch || pruebaFilterCategory || pruebaFilterGender
                    ? t("Sin resultados para los filtros aplicados.")
                    : t("No hay disciplinas asignadas a este evento.")
                  : t("Selecciona un evento para ver sus disciplinas.")}
              </div>
            )}

            {filteredDisciplines.map((discipline, idx) => {
              const pruebas = pruebasOf(discipline.id);
              const isFocused = focusDisciplineId === discipline.id;
              const isOpen = expandedPruebas.has(discipline.id);
              return (
                <div
                  key={discipline.id}
                  style={{
                    borderBottom: idx < filteredDisciplines.length - 1 ? "1px solid #e2e8f0" : "none",
                    ...(isFocused ? { background: "rgba(33,208,179,0.04)" } : {}),
                  }}
                >
                  {/* Discipline header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 20px" }}>
                    <button
                      onClick={() => togglePruebas(discipline.id)}
                      style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", minWidth: 0 }}
                    >
                      <svg
                        style={{ width: "16px", height: "16px", flexShrink: 0, color: "#94a3b8", transition: "transform 150ms ease", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{discipline.name}</span>
                      {(discipline.category || discipline.gender) && (
                        <span style={{ fontSize: "12px", color: "#94a3b8", flexShrink: 0 }}>
                          {[categoryLabel(discipline.category), genderLabel(discipline.gender)].filter(v => v !== "-").map(v => t(v)).join(" · ")}
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: "12px", color: "#cbd5e1", flexShrink: 0, paddingRight: "8px" }}>
                        {pruebas.length} {pruebas.length === 1 ? t("prueba") : t("pruebas")}
                      </span>
                    </button>
                    <button
                      style={{ ...ghostBtn, fontSize: "12px", padding: "5px 12px", flexShrink: 0 }}
                      onClick={() => { openAddPrueba(discipline.id); setExpandedPruebas(prev => new Set([...prev, discipline.id])); }}
                    >
                      {t("+ Prueba")}
                    </button>
                  </div>

                  {/* Pruebas list */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid #f1f5f9" }}>
                      {pruebas.length === 0 ? (
                        <p style={{ padding: "10px 56px", fontSize: "12px", color: "#cbd5e1", fontStyle: "italic" }}>
                          {t("Sin pruebas. Haz clic en \"+ Prueba\" para agregar.")}
                        </p>
                      ) : (
                        <div>
                          {pruebas.map((prueba, pi) => (
                            <div key={prueba.id} style={{
                              display: "flex", alignItems: "center", gap: "12px",
                              padding: "10px 56px",
                              borderTop: pi > 0 ? "1px solid #f1f5f9" : "none",
                            }}>
                              <svg style={{ width: "12px", height: "12px", color: "#cbd5e1", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                              </svg>
                              <span style={{ fontSize: "13px", color: "#334155", flex: 1 }}>{prueba.name}</span>
                              {(prueba.category || prueba.gender) && (
                                <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                                  {[categoryLabel(prueba.category), genderLabel(prueba.gender)].filter(v => v !== "-").map(v => t(v)).join(" · ")}
                                </span>
                              )}
                              <button onClick={() => openEditPrueba(prueba)} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: "4px" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#cbd5e1"; }}
                              >
                                <svg style={{ width: "14px", height: "14px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button onClick={() => removePrueba(prueba)} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: "4px" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#cbd5e1"; }}
                              >
                                <svg style={{ width: "14px", height: "14px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Calendario tab */}
      {tab === "calendario" && (() => {
        // Collect all pruebas (disciplines with parentId) that have scheduledAt, from the current event
        const calendarPruebas = disciplines
          .filter(d => d.parentId && d.scheduledAt && (selectedEventId ? d.eventId === selectedEventId : true))
          .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());

        // Build parent discipline name map
        const parentMap = new Map(disciplines.filter(d => !d.parentId).map(d => [d.id, d.name ?? d.id]));

        // Group by date
        const byDay = new Map<string, typeof calendarPruebas>();
        calendarPruebas.forEach(d => {
          const day = d.scheduledAt!.slice(0, 10);
          if (!byDay.has(day)) byDay.set(day, []);
          byDay.get(day)!.push(d);
        });
        const days = Array.from(byDay.keys()).sort();

        const unscheduled = disciplines.filter(d => d.parentId && !d.scheduledAt && (selectedEventId ? d.eventId === selectedEventId : true));

        return (
          <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", overflow: "hidden", boxShadow: pal.cardShadow }}>
            {calendarPruebas.length === 0 && unscheduled.length === 0 && (
              <div style={{ padding: "48px 24px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
                {selectedEventId
                  ? "No hay pruebas con horario asignado. Edita una prueba en la pestaña Pruebas para asignarle fecha y hora."
                  : "Selecciona un evento para ver su calendario deportivo."}
              </div>
            )}

            {days.map(day => {
              const items = byDay.get(day)!;
              const dateLabel = new Date(day + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
              return (
                <div key={day} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  {/* Day header */}
                  <div style={{ padding: "12px 20px", background: "linear-gradient(to bottom, #eaf4fb, #e8f0f8)", display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#1FCDFF" }}>{dateLabel}</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#1FCDFF", opacity: 0.6 }}>{items.length} prueba{items.length !== 1 ? "s" : ""}</span>
                  </div>
                  {/* Pruebas for this day */}
                  {items.map((prueba, pi) => {
                    const time = new Date(prueba.scheduledAt!).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
                    const catColor = CATEGORY_COLORS[prueba.category ?? ""] ?? "#94a3b8";
                    const genColor = GENDER_COLORS[(prueba.gender ?? "").trim().toUpperCase()] ?? "#94a3b8";
                    return (
                      <div key={prueba.id} style={{
                        display: "flex", alignItems: "center", gap: "16px", padding: "12px 20px",
                        borderTop: pi > 0 ? "1px solid #f1f5f9" : "none",
                      }}>
                        {/* Time */}
                        <div style={{ flexShrink: 0, textAlign: "center", minWidth: "52px" }}>
                          <p style={{ fontSize: "17px", fontWeight: 800, color: "#21D0B3", lineHeight: 1 }}>{time}</p>
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prueba.name}</p>
                          <p style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{parentMap.get(prueba.parentId!) ?? ""}</p>
                        </div>
                        {/* Venue */}
                        {prueba.venueName && (
                          <span style={{ fontSize: "12px", color: "#64748b", flexShrink: 0 }}>{prueba.venueName}</span>
                        )}
                        {/* Badges */}
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          {prueba.category && (
                            <span style={{ background: `${catColor}18`, border: `1px solid ${catColor}35`, borderRadius: "99px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, color: catColor }}>
                              {categoryLabel(prueba.category)}
                            </span>
                          )}
                          {prueba.gender && (
                            <span style={{ background: `${genColor}18`, border: `1px solid ${genColor}35`, borderRadius: "99px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, color: genColor }}>
                              {genderLabel(prueba.gender)}
                            </span>
                          )}
                        </div>
                        {/* Edit button */}
                        <button onClick={() => openEditPrueba(prueba)} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: "4px", flexShrink: 0 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#cbd5e1"; }}>
                          <svg style={{ width: "14px", height: "14px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Unscheduled pruebas */}
            {unscheduled.length > 0 && (
              <div>
                <div style={{ padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#94a3b8" }}>Sin horario asignado · {unscheduled.length}</span>
                </div>
                {unscheduled.map((prueba, pi) => (
                  <div key={prueba.id} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "10px 20px", borderTop: pi > 0 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ flexShrink: 0, minWidth: "52px" }}>
                      <p style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: 600 }}>—</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: "13px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prueba.name}</p>
                      <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>{parentMap.get(prueba.parentId!) ?? ""}</p>
                    </div>
                    <button onClick={() => openEditPrueba(prueba)} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: "4px", flexShrink: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#cbd5e1"; }}>
                      <svg style={{ width: "14px", height: "14px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      {/* ── Prueba modal */}
      {pruebaModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", padding: "16px" }}>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "380px", boxShadow: "0 8px 40px rgba(15,23,42,0.15)" }}>
            <h2 style={{ fontWeight: 700, fontSize: "18px", color: "#0f172a", marginBottom: "4px" }}>
              {pruebaModal.editing ? t("Editar prueba") : t("Nueva prueba")}
            </h2>
            <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "20px" }}>
              {eventDisciplines.find(d => d.id === pruebaModal.parentId)?.name ?? ""}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Nombre *")}</span>
                <input
                  style={fieldStyle}
                  value={pruebaForm.name}
                  onChange={e => setPruebaForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ej: 100 metros planos"
                  autoFocus
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Categoría")}</span>
                  <StyledSelect value={pruebaForm.category} onChange={e => setPruebaForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">—</option>
                    <option value="CONVENTIONAL">{t("Convencional")}</option>
                    <option value="PARALYMPIC">{t("Paralímpica")}</option>
                  </StyledSelect>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Género")}</span>
                  <StyledSelect value={pruebaForm.gender} onChange={e => setPruebaForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="">—</option>
                    <option value="MALE">{t("Masculino")}</option>
                    <option value="FEMALE">{t("Femenino")}</option>
                    <option value="MIXED">{t("Mixto")}</option>
                  </StyledSelect>
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Fecha y hora")}</span>
                <input
                  style={fieldStyle}
                  type="datetime-local"
                  value={pruebaForm.scheduledAt}
                  onChange={e => setPruebaForm(f => ({ ...f, scheduledAt: e.target.value }))}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Recinto")}</span>
                <select
                  style={fieldStyle}
                  value={pruebaForm.venueName}
                  onChange={e => setPruebaForm(f => ({ ...f, venueName: e.target.value }))}
                >
                  <option value="">{t("Selecciona una sede")}</option>
                  {(() => {
                    const byEvent = selectedEventId ? venueOptions.filter((v) => v.eventId === selectedEventId) : [];
                    const list = byEvent.length > 0 ? byEvent : venueOptions;
                    return list.map((v) => (
                      <option key={v.id} value={v.name}>{v.name}{v.address ? ` — ${v.address}` : ""}</option>
                    ));
                  })()}
                </select>
              </label>
            </div>

            {pruebaError && <p style={{ marginTop: "12px", fontSize: "13px", color: "#ef4444" }}>{pruebaError}</p>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "20px" }}>
              <button style={ghostBtn} onClick={() => setPruebaModal(null)} disabled={pruebaSaving}>{t("Cancelar")}</button>
              <button style={{ ...primaryBtn, opacity: pruebaSaving ? 0.7 : 1 }} onClick={savePrueba} disabled={pruebaSaving}>
                {pruebaSaving ? t("Guardando…") : t("Guardar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
