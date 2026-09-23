"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { BRAND, STATE, SURFACE, ACCENT } from "@/lib/design";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MedalIcon,
  PinIcon,
  XIcon,
  LayoutGridIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { filterValidatedAthletes } from "@/lib/athletes";
import { delegationLabel } from "@/lib/delegations";
import { nombreCortoRegion, pruebaVisiblePara } from "@/lib/pruebas";
import { useI18n } from "@/lib/i18n";
import { useIsMobile } from "@/lib/useIsMobile";
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
  /** Delegaciones (regiones) que participan; un partido lleva dos. Vacío = general. */
  delegationIds?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

type Delegation = {
  id: string;
  eventId?: string | null;
  countryCode?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
};

type Athlete = {
  id: string;
  fullName?: string | null;
  eventId?: string | null;
  delegationId?: string | null;
  disciplineId?: string | null;
  userType?: string | null;
};

type PremiacionAwarderForm = { athleteId: string; role: string };
type PremiacionForm = {
  enabled: boolean;
  id?: string;
  scheduledAt: string;
  venueId: string;
  venueName: string;
  locationDetail: string;
  notes: string;
  awarders: PremiacionAwarderForm[];
};
const EMPTY_PREMIACION: PremiacionForm = {
  enabled: false,
  scheduledAt: "",
  venueId: "",
  venueName: "",
  locationDetail: "",
  notes: "",
  awarders: [],
};
const PREMIACION_ROLES = [
  { value: "GOLD", label: "Oro" },
  { value: "SILVER", label: "Plata" },
  { value: "BRONZE", label: "Bronce" },
  { value: "AUTHORITY", label: "Autoridad" },
  { value: "AWARDER", label: "Premiador" },
];

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
  PARALYMPIC: ACCENT.violetLight,
};
const GENDER_COLORS: Record<string, string> = {
  MALE: "#60a5fa", FEMALE: "#f472b6", MIXED: "#34d399",
  M: "#60a5fa", F: "#f472b6", X: "#34d399",
};

const EMPTY_PRUEBA = { name: "", category: "", gender: "", scheduledAt: "", venueName: "", delegationIds: [] as string[], useDateRange: false, rangeStart: "", rangeEnd: "", rangeTime: "" };

const pal = {
  accent: BRAND.teal,
  titleColor: SURFACE.text,
  subtitleColor: SURFACE.textMuted,
  cardShadow: "0 1px 4px rgba(15,23,42,0.06)",
  labelColor: SURFACE.textFaint,
  kpi: [BRAND.teal, STATE.success, STATE.warning] as [string, string, string],
};

const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: "10px",
  border: `1px solid ${SURFACE.border}`, background: SURFACE.bg,
  fontSize: "14px", color: SURFACE.text, outline: "none",
};

// ── KPI icons
const GridIcon = ({ color, size = 20 }: { color: string; size?: number }) => (
  <LayoutGridIcon size={size} color={color} strokeWidth={1.8} />
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
  padding: "7px 14px", borderRadius: "10px", border: `1px solid ${SURFACE.border}`,
  background: SURFACE.card, color: SURFACE.textMuted, fontWeight: 600, fontSize: "13px",
  cursor: "pointer",
};
const primaryBtn: React.CSSProperties = {
  padding: "9px 20px", borderRadius: "10px", border: "none",
  background: `linear-gradient(135deg, ${BRAND.teal}, #14AE98)`, color: SURFACE.card,
  fontWeight: 700, fontSize: "13px", cursor: "pointer",
  boxShadow: "0 2px 8px rgba(33,208,179,0.3)",
};

export default function DeportesPage() {
  const { t } = useI18n();
  // Los layouts de esta pantalla van en estilos inline (paddings, grillas de
  // formulario, columna fija del Gantt), así que no pueden usar media queries.
  const isMobile = useIsMobile();

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
  const [calMonthCursor, setCalMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [calSelectedDay, setCalSelectedDay] = useState(() => new Date());
  const [calView, setCalView] = useState<"gantt" | "month" | "week" | "day" | "table">("gantt");
  /** Región: sólo las pruebas donde participa (las generales siempre). */
  const [calDelegationFilter, setCalDelegationFilter] = useState<string>("");
  const [calDayModalOpen, setCalDayModalOpen] = useState(false);
  const [ganttBar, setGanttBar] = useState<null | { title: string; cat: string; color: string; events: Discipline[] }>(null);
  const [calVenueFilter, setCalVenueFilter] = useState<string>("");
  const [calCategoryFilter, setCalCategoryFilter] = useState<string>("");
  const [calDisciplineFilter, setCalDisciplineFilter] = useState<string>("");
  const [calQuickSearch, setCalQuickSearch] = useState<string>("");
  const [pruebaForm, setPruebaForm] = useState(EMPTY_PRUEBA);
  const [premiacion, setPremiacion] = useState<PremiacionForm>(EMPTY_PREMIACION);
  const vipAthletes = useMemo(
    () => (athletes || []).filter((a) => String(a.userType ?? "").toUpperCase() === "VIP"),
    [athletes],
  );
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

  // Al cargar las pruebas por primera vez, posiciona el calendario en el mes
  // de la próxima prueba (o la más cercana) para no abrir en un mes vacío.
  const calAutoJumped = useRef(false);
  useEffect(() => {
    if (calAutoJumped.current) return;
    const pruebas = disciplines.filter(
      (d) => d.parentId && d.scheduledAt && (selectedEventId ? d.eventId === selectedEventId : true),
    );
    if (pruebas.length === 0) return;
    const now = Date.now();
    const sorted = [...pruebas].sort(
      (a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
    );
    const target = sorted.find((d) => new Date(d.scheduledAt!).getTime() >= now) || sorted[0];
    const td = new Date(target.scheduledAt!);
    setCalMonthCursor(new Date(td.getFullYear(), td.getMonth(), 1));
    setCalSelectedDay(td);
    calAutoJumped.current = true;
  }, [disciplines, selectedEventId]);

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

  /** Regiones de una prueba, cortas y en el orden guardado ("Maule", "Coquimbo"). */
  const regionesDePrueba = (d: Discipline): string[] =>
    (d.delegationIds ?? []).map((id) => {
      const deleg = delegations.find((x) => x.id === id);
      return deleg ? nombreCortoRegion(delegationLabel(deleg)) : "";
    }).filter(Boolean);

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
    setPremiacion(EMPTY_PREMIACION);
    setPruebaError(null);
    setPruebaModal({ parentId });
  };

  const loadPremiacionForDiscipline = async (disciplineId: string) => {
    try {
      const existing = await apiFetch<any>(`/premiaciones/by-discipline/${disciplineId}`);
      if (!existing) {
        setPremiacion(EMPTY_PREMIACION);
        return;
      }
      const iso = existing.scheduled_at;
      const dt = iso ? new Date(iso) : null;
      const scheduledAtLocal = dt
        ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
        : "";
      setPremiacion({
        enabled: true,
        id: existing.id,
        scheduledAt: scheduledAtLocal,
        venueId: existing.venue_id || "",
        venueName: existing.venue_name || "",
        locationDetail: existing.location_detail || "",
        notes: existing.notes || "",
        awarders: (existing.awarders || []).map((a: any) => ({
          athleteId: a.athlete_id,
          role: a.role,
        })),
      });
    } catch {
      setPremiacion(EMPTY_PREMIACION);
    }
  };

  const openEditPrueba = (d: Discipline) => {
    setPruebaForm({
      name: d.name ?? "",
      category: d.category ?? "",
      gender: d.gender ?? "",
      scheduledAt: d.scheduledAt ? (() => { const dt = new Date(d.scheduledAt); const y = dt.getFullYear(); const m = String(dt.getMonth()+1).padStart(2,"0"); const day = String(dt.getDate()).padStart(2,"0"); const h = String(dt.getHours()).padStart(2,"0"); const mi = String(dt.getMinutes()).padStart(2,"0"); return `${y}-${m}-${day}T${h}:${mi}`; })() : "",
      venueName: d.venueName ?? "",
      delegationIds: d.delegationIds ?? [],
      useDateRange: false,
      rangeStart: "",
      rangeEnd: "",
      rangeTime: "",
    });
    setPremiacion(EMPTY_PREMIACION);
    void loadPremiacionForDiscipline(d.id);
    setPruebaError(null);
    setPruebaModal({ editing: d, parentId: d.parentId! });
  };

  const savePremiacionForDiscipline = async (disciplineId: string) => {
    if (!premiacion.enabled) {
      if (premiacion.id) {
        try { await apiFetch(`/premiaciones/${premiacion.id}`, { method: "DELETE" }); } catch {}
      }
      return;
    }
    const defaultScheduledAt = pruebaForm.scheduledAt
      ? new Date(pruebaForm.scheduledAt).toISOString()
      : new Date().toISOString();
    const payload = {
      disciplineId,
      eventId: selectedEventId || undefined,
      title: pruebaForm.name.trim() || "Premiación",
      discipline: undefined,
      scheduledAt: premiacion.scheduledAt
        ? new Date(premiacion.scheduledAt).toISOString()
        : defaultScheduledAt,
      venueName: premiacion.venueName || pruebaForm.venueName || undefined,
      venueId: premiacion.venueId || undefined,
      locationDetail: premiacion.locationDetail || undefined,
      notes: premiacion.notes || undefined,
      status: "PROGRAMADA",
      awarders: premiacion.awarders.filter((a) => a.athleteId),
    };
    if (premiacion.id) {
      await apiFetch(`/premiaciones/${premiacion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch(`/premiaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  };

  const savePrueba = async () => {
    if (!pruebaForm.name.trim()) { setPruebaError("El nombre es requerido."); return; }
    setPruebaSaving(true);
    setPruebaError(null);
    try {
      if (pruebaForm.useDateRange && !pruebaModal?.editing && pruebaForm.rangeStart && pruebaForm.rangeEnd && pruebaForm.rangeTime) {
        // Create one prueba per day in the range
        const start = new Date(pruebaForm.rangeStart + "T00:00:00");
        const end = new Date(pruebaForm.rangeEnd + "T00:00:00");
        const [hours, minutes] = pruebaForm.rangeTime.split(":").map(Number);
        let created = 0;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = d.getFullYear();
          const hh = String(hours).padStart(2, "0");
          const mi = String(minutes).padStart(2, "0");
          const scheduledAt = new Date(yyyy, d.getMonth(), d.getDate(), hours, minutes, 0).toISOString();
          const dateLabel = `${dd}/${mm}`;
          await apiFetch("/disciplines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `${pruebaForm.name.trim()} (${dateLabel})`,
              category: pruebaForm.category || null,
              gender: pruebaForm.gender || null,
              parentId: pruebaModal!.parentId,
              eventId: selectedEventId || null,
              scheduledAt,
              venueName: pruebaForm.venueName || null,
              delegationIds: pruebaForm.delegationIds,
            }),
          });
          created++;
        }
        setPruebaModal(null);
        await load();
      } else {
        const body = {
          name: pruebaForm.name.trim(),
          category: pruebaForm.category || null,
          gender: pruebaForm.gender || null,
          parentId: pruebaModal!.parentId,
          eventId: selectedEventId || null,
          scheduledAt: pruebaForm.scheduledAt ? new Date(pruebaForm.scheduledAt).toISOString() : null,
          venueName: pruebaForm.venueName || null,
          delegationIds: pruebaForm.delegationIds,
        };
        let disciplineId: string | null = null;
        if (pruebaModal?.editing) {
          await apiFetch(`/disciplines/${pruebaModal.editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          disciplineId = pruebaModal.editing.id;
        } else {
          const created = await apiFetch<{ id: string }>("/disciplines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          disciplineId = created?.id ?? null;
        }
        if (disciplineId) {
          await savePremiacionForDiscipline(disciplineId);
        }
        setPruebaModal(null);
        await load();
      }
    } catch (e) {
      setPruebaError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setPruebaSaving(false);
    }
  };

  const [deletePruebaConfirm, setDeletePruebaConfirm] = useState<Discipline | null>(null);
  const removePrueba = async (d: Discipline) => {
    try {
      await apiFetch(`/disciplines/${d.id}`, { method: "DELETE" });
      setDeletePruebaConfirm(null);
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
      <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "20px", padding: isMobile ? "16px 14px 14px" : "24px 28px 22px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: SURFACE.textFaint }}>{t("Deportes")}</span>
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
        <div style={{ background: SURFACE.borderMuted, borderRadius: "12px", padding: "4px", width: "fit-content", display: "flex", gap: "4px" }}>
          {([["cupos", t("Cupos")], ["pruebas", t("Pruebas")], ["calendario", t("Calendario")]] as const).map(([tabKey, label]) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              style={{
                padding: "7px 20px", borderRadius: "9px", fontSize: "13px", fontWeight: 700,
                letterSpacing: "0.04em", border: "none", cursor: "pointer",
                transition: "all 150ms ease",
                background: tab === tabKey ? `linear-gradient(135deg, ${BRAND.teal}, #14AE98)` : "transparent",
                color: tab === tabKey ? SURFACE.card : SURFACE.textMuted,
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
                  background: SURFACE.card, border: `1px solid ${card.color}30`,
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
                  background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, borderRadius: "99px",
                  padding: "4px 14px", fontSize: "12px", fontWeight: 600, color: SURFACE.textMuted,
                }}>{t("Página {p} de {total}").replace("{p}", String(page)).replace("{total}", String(totalPages))}</span>
                <button style={{ ...ghostBtn, opacity: page >= totalPages ? 0.5 : 1 }} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>{t("Siguiente")}</button>
              </div>
              <button style={{ ...primaryBtn, opacity: saving || !selectedEventId || filteredRows.length === 0 ? 0.6 : 1, cursor: saving || !selectedEventId || filteredRows.length === 0 ? "not-allowed" : "pointer" }} onClick={saveQuotas} disabled={saving || !selectedEventId || filteredRows.length === 0}>
                {saving ? t("Guardando...") : t("Guardar cupos")}
              </button>
            </div>

            {message ? <p style={{ marginTop: "10px", fontSize: "13px", color: BRAND.teal, fontWeight: 600 }}>{message}</p> : null}
            {error ? <p style={{ marginTop: "10px", fontSize: "13px", color: STATE.danger }}>{error}</p> : null}
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
          background: SURFACE.card, border: `1px solid ${SURFACE.border}`,
          borderRadius: "20px", overflow: "hidden", boxShadow: pal.cardShadow,
        }}>
          {loading ? (
            <p style={{ padding: "24px", fontSize: "13px", color: SURFACE.textMuted }}>{t("Cargando filas...")}</p>
          ) : filteredRows.length === 0 ? (
            <p style={{ padding: "24px", fontSize: "13px", color: SURFACE.textFaint }}>{t("No hay filas para los filtros seleccionados.")}</p>
          ) : (
            <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: "960px", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: SURFACE.bg }}>
                    {[t("Delegación"), t("Disciplina"), t("Tipo"), t("Género"), "AND", t("Cupo esperado")].map((h) => (
                      <th key={h} style={{
                        padding: "13px 16px", textAlign: "left", fontSize: "10px",
                        fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
                        color: SURFACE.textFaint, borderBottom: `1px solid ${SURFACE.border}`,
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, idx) => {
                    const catColor = CATEGORY_COLORS[row.category] ?? SURFACE.textFaint;
                    const genColor = GENDER_COLORS[row.gender.trim().toUpperCase()] ?? SURFACE.textFaint;
                    return (
                      <tr key={row.key} style={{
                        background: idx % 2 === 0 ? SURFACE.card : SURFACE.bg,
                        borderBottom: `1px solid ${SURFACE.border}`, transition: "background 100ms ease",
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = SURFACE.borderMuted; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? SURFACE.card : SURFACE.bg; }}
                      >
                        <td style={{ padding: "11px 16px", fontWeight: 700, color: SURFACE.text, letterSpacing: "0.04em" }}>{row.delegationCode}</td>
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
                        <td style={{ padding: "11px 16px", color: SURFACE.text, fontWeight: 600 }}>{row.andCount}</td>
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
          background: SURFACE.card, border: `1px solid ${SURFACE.border}`,
          borderRadius: "20px", overflow: "hidden", boxShadow: pal.cardShadow,
        }}>
          <div style={{ overflowY: "auto", maxHeight: "560px" }}>
            {filteredDisciplines.length === 0 && (
              <div style={{ padding: "32px", textAlign: "center", fontSize: "13px", color: SURFACE.textFaint }}>
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
                    borderBottom: idx < filteredDisciplines.length - 1 ? `1px solid ${SURFACE.border}` : "none",
                    ...(isFocused ? { background: "rgba(33,208,179,0.04)" } : {}),
                  }}
                >
                  {/* Discipline header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: isMobile ? "12px 14px" : "14px 20px" }}>
                    {/* En teléfono la etiqueta de tipo/género baja a una segunda línea
                        (order + flexBasis 100%) para que el nombre no quede en cero. */}
                    <button
                      onClick={() => togglePruebas(discipline.id)}
                      style={{ display: "flex", alignItems: "center", gap: isMobile ? "8px 12px" : "12px", flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", minWidth: 0, flexWrap: isMobile ? "wrap" : undefined }}
                    >
                      <svg
                        style={{ width: "16px", height: "16px", flexShrink: 0, color: SURFACE.textFaint, transition: "transform 150ms ease", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <span style={{ fontWeight: 600, color: SURFACE.text, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{discipline.name}</span>
                      {(discipline.category || discipline.gender) && (
                        <span style={{ fontSize: "12px", color: SURFACE.textFaint, flexShrink: 0, ...(isMobile ? { order: 10, flexBasis: "100%", paddingLeft: "28px" } : {}) }}>
                          {[categoryLabel(discipline.category), genderLabel(discipline.gender)].filter(v => v !== "-").map(v => t(v)).join(" · ")}
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: "12px", color: SURFACE.borderStrong, flexShrink: 0, paddingRight: "8px" }}>
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
                    <div style={{ borderTop: `1px solid ${SURFACE.borderMuted}` }}>
                      {pruebas.length === 0 ? (
                        <p style={{ padding: isMobile ? "10px 16px" : "10px 56px", fontSize: "12px", color: SURFACE.borderStrong, fontStyle: "italic" }}>
                          {t("Sin pruebas. Haz clic en \"+ Prueba\" para agregar.")}
                        </p>
                      ) : (
                        <div>
                          {pruebas.map((prueba, pi) => (
                            <div key={prueba.id} style={{
                              display: "flex", alignItems: "center", gap: isMobile ? "6px 12px" : "12px",
                              padding: isMobile ? "10px 16px" : "10px 56px",
                              flexWrap: isMobile ? "wrap" : undefined,
                              borderTop: pi > 0 ? `1px solid ${SURFACE.borderMuted}` : "none",
                            }}>
                              <svg style={{ width: "12px", height: "12px", color: SURFACE.borderStrong, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                              </svg>
                              <span style={{ fontSize: "13px", color: SURFACE.textStrong, flex: 1, minWidth: 0 }}>{prueba.name}</span>
                              {regionesDePrueba(prueba).map((region) => (
                                <span key={region} style={{ fontSize: "11px", fontWeight: 700, color: BRAND.teal, background: "rgba(33,208,179,0.10)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "2px 8px", whiteSpace: "nowrap" }}>
                                  {region}
                                </span>
                              ))}
                              {(prueba.category || prueba.gender) && (
                                <span style={{ fontSize: "12px", color: SURFACE.textFaint, ...(isMobile ? { order: 10, flexBasis: "100%", paddingLeft: "24px" } : {}) }}>
                                  {[categoryLabel(prueba.category), genderLabel(prueba.gender)].filter(v => v !== "-").map(v => t(v)).join(" · ")}
                                </span>
                              )}
                              <button onClick={() => openEditPrueba(prueba)} style={{ background: "none", border: "none", cursor: "pointer", color: SURFACE.borderStrong, padding: "4px" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = SURFACE.textMuted; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = SURFACE.borderStrong; }}
                              >
                                <svg style={{ width: "14px", height: "14px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button onClick={() => setDeletePruebaConfirm(prueba)} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", padding: "4px" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = STATE.danger; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
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

      {/* ── Calendario tab ── (rediseñado con vistas, KPIs y filtros) */}
      {tab === "calendario" && (() => {
        const allCalendarPruebas = disciplines
          .filter(d => d.parentId && d.scheduledAt && (selectedEventId ? d.eventId === selectedEventId : true))
          .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());

        // Aplicar filtros
        const calendarPruebas = allCalendarPruebas.filter(d => {
          if (calVenueFilter && (d.venueName || "") !== calVenueFilter) return false;
          if (calCategoryFilter && (d.category || "") !== calCategoryFilter) return false;
          if (calDisciplineFilter && (d.parentId || "") !== calDisciplineFilter) return false;
          if (!pruebaVisiblePara(d, calDelegationFilter || null)) return false;
          if (calQuickSearch.trim()) {
            const q = calQuickSearch.trim().toLowerCase();
            const text = `${d.name} ${d.venueName || ""} ${regionesDePrueba(d).join(" ")}`.toLowerCase();
            if (!text.includes(q)) return false;
          }
          return true;
        });

        const parentMap = new Map(disciplines.filter(d => !d.parentId).map(d => [d.id, d.name ?? d.id]));

        // Disciplinas con pruebas agendadas (para el filtro de disciplina)
        const disciplineList = Array.from(
          new Map(
            allCalendarPruebas
              .filter(d => d.parentId)
              .map(d => [d.parentId as string, parentMap.get(d.parentId as string) || (d.parentId as string)]),
          ).entries(),
        ).sort((a, b) => a[1].localeCompare(b[1]));

        // Sedes únicas con paleta de colores estilo Excel
        const VENUE_PALETTE = [
          { bg: `linear-gradient(135deg,${STATE.dangerBorder},${STATE.dangerBorder})`, fg: "#7f1d1d", ring: STATE.dangerText }, // rojo
          { bg: `linear-gradient(135deg,${STATE.warningBorder},${STATE.warning})`, fg: STATE.warningText, ring: STATE.warningText }, // amarillo
          { bg: `linear-gradient(135deg,${STATE.infoBorder},${STATE.infoBorder})`, fg: "#1e3a8a", ring: STATE.infoText }, // azul
          { bg: "linear-gradient(135deg,#a7f3d0,#6ee7b7)", fg: "#064e3b", ring: STATE.successText }, // verde
          { bg: "linear-gradient(135deg,#ddd6fe,#c4b5fd)", fg: "#4c1d95", ring: ACCENT.violet }, // violeta
          { bg: "linear-gradient(135deg,#fbcfe8,#f9a8d4)", fg: "#831843", ring: "#db2777" }, // rosa
          { bg: "linear-gradient(135deg,#a5f3fc,#67e8f9)", fg: "#164e63", ring: "#0891b2" }, // cyan
        ];
        const venueList = Array.from(new Set(allCalendarPruebas.map(d => d.venueName).filter(Boolean) as string[])).sort();
        const venueColorMap = new Map(venueList.map((v, i) => [v, VENUE_PALETTE[i % VENUE_PALETTE.length]]));
        const venueColor = (name?: string | null) =>
          (name && venueColorMap.get(name)) || VENUE_PALETTE[6];

        const categoryList = Array.from(new Set(allCalendarPruebas.map(d => d.category).filter(Boolean) as string[])).sort();

        // Group by ISO day key
        const byDay = new Map<string, typeof calendarPruebas>();
        calendarPruebas.forEach(d => {
          const day = d.scheduledAt!.slice(0, 10);
          if (!byDay.has(day)) byDay.set(day, []);
          byDay.get(day)!.push(d);
        });

        // KPIs del mes mostrado
        const now = Date.now();
        const next24h = now + 86400000;
        const kpiTotal = calendarPruebas.length;
        const kpiToday = calendarPruebas.filter(d => d.scheduledAt!.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
        const kpiUpcoming = calendarPruebas.filter(d => {
          const t = new Date(d.scheduledAt!).getTime();
          return t >= now && t <= next24h;
        }).length;
        const kpiVenues = venueList.length;

        const WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

        const buildGrid = (cursor: Date) => {
          const y = cursor.getFullYear(), m = cursor.getMonth();
          const first = new Date(y, m, 1);
          const startDow = (first.getDay() + 6) % 7;
          const days: Date[] = [];
          for (let i = -startDow; days.length < 42; i++) {
            days.push(new Date(y, m, 1 + i));
          }
          return days;
        };

        const buildWeek = (cursor: Date) => {
          const d = new Date(cursor);
          const jsDay = d.getDay();
          const monday = new Date(d);
          monday.setDate(d.getDate() - ((jsDay + 6) % 7));
          monday.setHours(0, 0, 0, 0);
          return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            return day;
          });
        };

        const grid = buildGrid(calMonthCursor);
        const week = buildWeek(calSelectedDay);
        const todayKey = new Date().toISOString().slice(0, 10);
        const curMonth = calMonthCursor.getMonth();
        const monthStr = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(calMonthCursor);

        const selectedDayKey = calSelectedDay.toISOString().slice(0, 10);
        const selectedItems = byDay.get(selectedDayKey) || [];
        const selectedDayLabel = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "2-digit", month: "long" }).format(calSelectedDay);

        const navPrev = () => {
          if (calView === "month" || calView === "gantt") setCalMonthCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
          else if (calView === "week") setCalSelectedDay(d => { const x = new Date(d); x.setDate(x.getDate() - 7); return x; });
          else setCalSelectedDay(d => { const x = new Date(d); x.setDate(x.getDate() - 1); return x; });
        };
        const navNext = () => {
          if (calView === "month" || calView === "gantt") setCalMonthCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
          else if (calView === "week") setCalSelectedDay(d => { const x = new Date(d); x.setDate(x.getDate() + 7); return x; });
          else setCalSelectedDay(d => { const x = new Date(d); x.setDate(x.getDate() + 1); return x; });
        };

        return (
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Pruebas totales", value: kpiTotal, color: BRAND.teal, bg: "rgba(33,208,179,0.10)" },
                { label: "Hoy", value: kpiToday, color: BRAND.blue, bg: "rgba(31,205,255,0.10)" },
                { label: "Próximas 24h", value: kpiUpcoming, color: kpiUpcoming > 0 ? STATE.warningText : SURFACE.textFaint, bg: kpiUpcoming > 0 ? "rgba(245,158,11,0.10)" : SURFACE.borderMuted },
                { label: "Sedes activas", value: kpiVenues, color: ACCENT.violet, bg: "rgba(124,58,237,0.10)" },
              ].map(k => (
                <div key={k.label} className="rounded-2xl p-4 relative overflow-hidden"
                  style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, boxShadow: "0 1px 4px rgba(15,23,42,0.06)", borderLeft: `4px solid ${k.color}` }}>
                  <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: k.bg, filter: "blur(20px)" }} />
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: SURFACE.textMuted, position: "relative" }}>
                    {k.label}
                  </p>
                  <p style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1.1, marginTop: 4, position: "relative" }}>
                    {k.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Toolbar: vista + búsqueda + filtros */}
            <section className="surface rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Vista toggle */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: SURFACE.borderMuted }}>
                  {(["gantt", "month", "week", "day", "table"] as const).map(v => {
                    const active = calView === v;
                    return (
                      <button key={v} type="button" onClick={() => setCalView(v)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: active ? `linear-gradient(135deg, ${BRAND.teal}, #1eb19a)` : "transparent",
                          color: active ? SURFACE.card : SURFACE.textSecondary,
                          boxShadow: active ? "0 2px 6px rgba(33,208,179,0.35)" : "none",
                        }}>
                        {v === "gantt" ? "Gantt" : v === "month" ? "Mes" : v === "week" ? "Semana" : v === "day" ? "Día" : "Tabla"}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={navPrev} className="btn btn-ghost text-xs" aria-label="Anterior"><ChevronLeftIcon size={16} /></button>
                  <button onClick={() => { const n = new Date(); setCalMonthCursor(new Date(n.getFullYear(), n.getMonth(), 1)); setCalSelectedDay(n); }} className="btn btn-ghost text-xs">Hoy</button>
                  <button onClick={navNext} className="btn btn-ghost text-xs" aria-label="Siguiente"><ChevronRightIcon size={16} /></button>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 800, color: SURFACE.text, textTransform: "capitalize", flex: 1 }}>
                  {calView === "gantt" ? monthStr
                    : calView === "month" ? monthStr
                    : calView === "week" ? `Sem. del ${week[0].toLocaleDateString("es-CL", { day: "2-digit", month: "short" })} al ${week[6].toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}`
                    : calView === "day" ? selectedDayLabel
                    : `${calendarPruebas.length} pruebas en agenda`}
                </h3>

                {/* Filtro de disciplina */}
                {disciplineList.length > 0 && (
                  <StyledSelect wrapperStyle={{ maxWidth: isMobile ? "100%" : 220 }}
                    value={calDisciplineFilter} onChange={(e) => setCalDisciplineFilter(e.target.value)}>
                    <option value="">{t("Todas las disciplinas")}</option>
                    {disciplineList.map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </StyledSelect>
                )}

                {/* Filtro de región: qué juega cada delegación */}
                {allCalendarPruebas.some((d) => (d.delegationIds ?? []).length > 0) && (
                  <StyledSelect wrapperStyle={{ maxWidth: isMobile ? "100%" : 220 }}
                    value={calDelegationFilter} onChange={(e) => setCalDelegationFilter(e.target.value)}>
                    <option value="">{t("Todas las regiones")}</option>
                    {eventDelegations.map((d) => (
                      <option key={d.id} value={d.id}>{nombreCortoRegion(delegationLabel(d)) || d.countryCode || d.id}</option>
                    ))}
                  </StyledSelect>
                )}

                {/* Búsqueda rápida */}
                <input className="input" style={{ maxWidth: isMobile ? "100%" : 240 }} placeholder="Buscar prueba, sede o región…"
                  value={calQuickSearch} onChange={(e) => setCalQuickSearch(e.target.value)} />
              </div>

              {/* Chips: sedes (color-coded) */}
              {venueList.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SURFACE.textMuted, marginRight: 4 }}>Sede:</span>
                  <button type="button"
                    onClick={() => setCalVenueFilter("")}
                    className="text-xs font-bold px-3 py-1 rounded-full transition-all"
                    style={{
                      background: !calVenueFilter ? `linear-gradient(135deg, ${BRAND.teal}, #1eb19a)` : SURFACE.borderMuted,
                      color: !calVenueFilter ? SURFACE.card : SURFACE.textSecondary,
                    }}>
                    Todas
                  </button>
                  {venueList.map(v => {
                    const pal = venueColor(v);
                    const active = calVenueFilter === v;
                    const count = allCalendarPruebas.filter(d => d.venueName === v).length;
                    return (
                      <button key={v} type="button"
                        onClick={() => setCalVenueFilter(active ? "" : v)}
                        className="text-xs font-bold px-3 py-1 rounded-full transition-all inline-flex items-center gap-1.5"
                        style={{
                          background: active ? pal.bg : SURFACE.card,
                          color: pal.fg,
                          border: `1.5px solid ${pal.ring}${active ? "" : "44"}`,
                          boxShadow: active ? `0 2px 8px ${pal.ring}55` : "none",
                        }}>
                        {v}
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: active ? "rgba(255,255,255,0.5)" : pal.bg, color: pal.fg, fontWeight: 800 }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Chips: categoría */}
              {categoryList.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SURFACE.textMuted, marginRight: 4 }}>Categoría:</span>
                  <button type="button" onClick={() => setCalCategoryFilter("")}
                    className="text-xs font-bold px-3 py-1 rounded-full transition-all"
                    style={{
                      background: !calCategoryFilter ? `linear-gradient(135deg, ${BRAND.teal}, #1eb19a)` : SURFACE.borderMuted,
                      color: !calCategoryFilter ? SURFACE.card : SURFACE.textSecondary,
                    }}>
                    Todas
                  </button>
                  {categoryList.map(cat => {
                    const color = CATEGORY_COLORS[cat] ?? SURFACE.textMuted;
                    const active = calCategoryFilter === cat;
                    return (
                      <button key={cat} type="button"
                        onClick={() => setCalCategoryFilter(active ? "" : cat)}
                        className="text-xs font-bold px-3 py-1 rounded-full transition-all"
                        style={{
                          background: active ? color : `${color}15`,
                          color: active ? SURFACE.card : color,
                          border: `1.5px solid ${color}${active ? "" : "44"}`,
                          boxShadow: active ? `0 2px 8px ${color}55` : "none",
                        }}>
                        {categoryLabel(cat)}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── VISTA GANTT (disciplinas en filas, días en columnas, barras por fase) */}
            {calView === "gantt" && (() => {
              type GCat = "CLASIFICATORIA" | "FINAL" | "TRAINING" | "CEREMONY" | "PRUEBA";
              const GCAT: Record<GCat, { label: string; bar: string; border: string; text: string; dot: string }> = {
                CLASIFICATORIA: { label: "Clasificatorias", bar: STATE.infoSoft, border: STATE.info, text: "#1e3a8a", dot: STATE.info },
                FINAL:          { label: "Finales",         bar: STATE.successSoft, border: STATE.success, text: "#14532d", dot: STATE.success },
                TRAINING:       { label: "Entrenamientos",  bar: STATE.warningSoft, border: STATE.warning, text: STATE.warningText, dot: STATE.warning },
                CEREMONY:       { label: "Ceremonias",      bar: "#f3e8ff", border: "#a855f7", text: "#581c87", dot: "#a855f7" },
                PRUEBA:         { label: "Pruebas",         bar: "#ccfbf1", border: BRAND.teal, text: "#115e59", dot: BRAND.teal },
              };
              const classifyCat = (name?: string | null): GCat => {
                const tx = (name || "").toLowerCase();
                if (/final/.test(tx)) return "FINAL";
                if (/clasif|elimin|series|semi|repechaje/.test(tx)) return "CLASIFICATORIA";
                if (/entren|práctic|practic|reconoc|activac/.test(tx)) return "TRAINING";
                if (/ceremon|premiac|inaugur|clausura/.test(tx)) return "CEREMONY";
                return "PRUEBA";
              };

              // Días del mes actual como columnas
              const gy = calMonthCursor.getFullYear(), gm = calMonthCursor.getMonth();
              const N = new Date(gy, gm + 1, 0).getDate();
              const days = Array.from({ length: N }, (_, i) => new Date(gy, gm, i + 1));
              const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const idxOf = new Map(days.map((d, i) => [keyOf(d), i] as const));

              // Filas por disciplina (parent), solo pruebas visibles del mes
              const DISC_PALETTE = [
                STATE.dangerText, STATE.warningText, STATE.infoText, STATE.successText, ACCENT.violet, "#db2777", "#0891b2", "#65a30d",
              ];
              const rowMap = new Map<string, { name: string; evs: typeof calendarPruebas }>();
              calendarPruebas.forEach(d => {
                const local = new Date(d.scheduledAt!);
                if (local.getFullYear() !== gy || local.getMonth() !== gm) return;
                const pid = d.parentId || "—";
                const pname = parentMap.get(pid) || pid;
                if (!rowMap.has(pid)) rowMap.set(pid, { name: pname, evs: [] });
                rowMap.get(pid)!.evs.push(d);
              });

              type Bar = { cat: GCat; start: number; span: number; lane: number; label: string; count: number; events: typeof calendarPruebas };
              const rows = Array.from(rowMap.entries()).map(([pid, data], ri) => {
                const byCat = new Map<GCat, Map<number, typeof calendarPruebas>>();
                data.evs.forEach(e => {
                  const idx = idxOf.get(keyOf(new Date(e.scheduledAt!)));
                  if (idx === undefined) return;
                  const cat = classifyCat(e.name);
                  if (!byCat.has(cat)) byCat.set(cat, new Map());
                  const m = byCat.get(cat)!;
                  m.set(idx, [...(m.get(idx) ?? []), e]);
                });
                const rawBars: Array<Omit<Bar, "lane">> = [];
                byCat.forEach((m, cat) => {
                  const idxs = Array.from(m.keys()).sort((a, b) => a - b);
                  let i = 0;
                  while (i < idxs.length) {
                    let j = i;
                    while (j + 1 < idxs.length && idxs[j + 1] === idxs[j] + 1) j++;
                    let count = 0;
                    const names = new Set<string>();
                    const evs: typeof calendarPruebas = [];
                    for (let dd = i; dd <= j; dd++) {
                      const list = m.get(idxs[dd]) ?? [];
                      count += list.length;
                      list.forEach(e => { if (e.name) names.add(e.name); evs.push(e); });
                    }
                    const label = names.size === 1 ? Array.from(names)[0] : GCAT[cat].label;
                    rawBars.push({ cat, start: idxs[i], span: idxs[j] - idxs[i] + 1, label, count, events: evs });
                    i = j + 1;
                  }
                });
                rawBars.sort((a, b) => a.start - b.start || b.span - a.span);
                const laneEnds: number[] = [];
                const bars: Bar[] = rawBars.map(b => {
                  let lane = laneEnds.findIndex(end => end < b.start);
                  if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
                  laneEnds[lane] = b.start + b.span - 1;
                  return { ...b, lane };
                });
                return { pid, name: data.name, color: DISC_PALETTE[ri % DISC_PALETTE.length], bars, lanes: Math.max(1, laneEnds.length) };
              }).sort((a, b) => a.name.localeCompare(b.name));

              // En teléfono la columna de nombres se angosta para dejar sitio a la grilla.
              const COL_MIN = 44, BAR_H = 24, LANE_GAP = 4, HEADER_H = 52, NAME_W = isMobile ? 120 : 200;
              const rowH = (lanes: number) => lanes * BAR_H + (lanes - 1) * LANE_GAP + 16;
              const todayK = keyOf(new Date());

              return (
                <section className="relative accent-strip-top animate-fade-up" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 20, padding: 16, boxShadow: pal.cardShadow }}>
                  {/* Leyenda */}
                  <div className="flex flex-wrap gap-3 mb-3">
                    {(["CLASIFICATORIA", "FINAL", "TRAINING", "CEREMONY", "PRUEBA"] as GCat[]).map(cat => (
                      <span key={cat} className="inline-flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 500, color: SURFACE.textMuted }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: GCAT[cat].dot, display: "inline-block" }} />
                        {GCAT[cat].label}
                      </span>
                    ))}
                  </div>

                  {rows.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl" style={{ background: `linear-gradient(135deg, ${SURFACE.bg} 0%, ${SURFACE.card} 100%)`, border: `1px dashed ${SURFACE.border}` }}>
                      <p style={{ margin: 0, color: SURFACE.borderStrong, display: "flex", justifyContent: "center" }}><CalendarIcon size={34} /></p>
                      <p className="text-sm font-semibold mt-2" style={{ color: SURFACE.textSecondary }}>Sin pruebas en {monthStr}</p>
                      <p className="text-xs mt-1" style={{ color: SURFACE.textFaint }}>Usa las flechas para cambiar de mes o carga pruebas en la pestaña Pruebas.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", border: `1px solid ${SURFACE.border}`, borderRadius: 14, overflow: "hidden", background: SURFACE.card }}>
                      {/* Columna de disciplinas */}
                      <div style={{ flex: `0 0 ${NAME_W}px`, borderRight: `1px solid ${SURFACE.border}`, background: SURFACE.card }}>
                        <div style={{ height: HEADER_H, display: "flex", alignItems: "center", padding: "0 14px", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: SURFACE.textFaint, borderBottom: `1px solid ${SURFACE.border}`, background: SURFACE.bg }}>
                          Disciplina
                        </div>
                        {rows.map((r, i) => (
                          <div key={r.pid} style={{ height: rowH(r.lanes), display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderBottom: i < rows.length - 1 ? `1px solid ${SURFACE.borderMuted}` : "none", background: i % 2 === 0 ? SURFACE.card : SURFACE.bg }}>
                            <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: `${r.color}14`, color: r.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>
                              {r.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: SURFACE.textStrong, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={SURFACE.borderStrong} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" /></svg>
                          </div>
                        ))}
                      </div>

                      {/* Grilla de días + barras */}
                      <div style={{ flex: 1, minWidth: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                        <div style={{ minWidth: N * COL_MIN }}>
                          <div style={{ height: HEADER_H, display: "grid", gridTemplateColumns: `repeat(${N}, minmax(${COL_MIN}px, 1fr))`, borderBottom: `1px solid ${SURFACE.border}`, background: SURFACE.bg }}>
                            {days.map((d, i) => {
                              const k = keyOf(d);
                              const isToday = k === todayK;
                              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                              return (
                                <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderLeft: i === 0 ? "none" : `1px solid ${SURFACE.borderMuted}`, background: isToday ? "rgba(33,208,179,0.12)" : isWeekend ? SURFACE.borderMuted : "transparent" }}>
                                  <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: isToday ? BRAND.tealDark : SURFACE.textFaint }}>{["DO", "LU", "MA", "MI", "JU", "VI", "SA"][d.getDay()]}</span>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? BRAND.tealDark : SURFACE.textStrong }}>{d.getDate()}</span>
                                </div>
                              );
                            })}
                          </div>
                          {rows.map((r, ri) => {
                            const gridLines = `repeating-linear-gradient(to right, transparent 0, transparent calc(${100 / N}% - 1px), #eef2f7 calc(${100 / N}% - 1px), #eef2f7 ${100 / N}%)`;
                            return (
                              <div key={r.pid} style={{ position: "relative", height: rowH(r.lanes), borderBottom: ri < rows.length - 1 ? `1px solid ${SURFACE.borderMuted}` : "none", background: ri % 2 === 0 ? SURFACE.card : SURFACE.bg, backgroundImage: gridLines, display: "grid", gridTemplateColumns: `repeat(${N}, minmax(${COL_MIN}px, 1fr))`, gridTemplateRows: `repeat(${r.lanes}, ${BAR_H}px)`, alignContent: "center", rowGap: LANE_GAP, padding: "8px 0" }}>
                                {r.bars.map((bar, bi) => {
                                  const meta = GCAT[bar.cat];
                                  return (
                                    <div key={bi} title={`${bar.label} · ${bar.count} prueba(s) — clic para ver detalle`}
                                      onClick={() => setGanttBar({ title: r.name, cat: meta.label, color: meta.border, events: [...bar.events].sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()) })}
                                      style={{ cursor: "pointer", gridColumn: `${bar.start + 1} / span ${bar.span}`, gridRow: bar.lane + 1, background: meta.bar, border: `1px solid ${meta.border}`, borderLeft: `3px solid ${meta.border}`, borderRadius: 7, height: BAR_H, display: "flex", alignItems: "center", gap: 4, padding: "0 8px", margin: "0 2px", overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}>
                                      <span style={{ fontSize: 11, fontWeight: 500, color: meta.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bar.label}</span>
                                      {bar.cat === "FINAL" && <span style={{ flexShrink: 0, display: "inline-flex" }}><MedalIcon size={11} /></span>}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              );
            })()}

            {/* ── VISTA MES (celdas grandes con mini-cards color-coded) */}
            {calView === "month" && (
              <section className="relative accent-strip-top animate-fade-up" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 20, overflow: "hidden", boxShadow: pal.cardShadow }}>
                {/* En móvil el mes scrollea horizontal en vez de aplastar los 7 días. */}
                <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
                <div style={{ minWidth: "640px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: SURFACE.bg, borderBottom: `1px solid ${SURFACE.border}`, paddingTop: 4 }}>
                  {WEEK.map(d => (
                    <div key={d} style={{ textAlign: "center", padding: "10px 0", fontSize: 11, fontWeight: 800, color: SURFACE.textSecondary, letterSpacing: "0.1em", textTransform: "uppercase" }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
                  {grid.map((day, i) => {
                    const dk = day.toISOString().slice(0, 10);
                    const isCurrentMonth = day.getMonth() === curMonth;
                    const isToday = dk === todayKey;
                    const isSelected = dk === selectedDayKey;
                    const events = byDay.get(dk) || [];
                    return (
                      <div key={i}
                        className="cal-day-cell"
                        onClick={() => { setCalSelectedDay(new Date(day)); setCalDayModalOpen(true); }}
                        style={{
                          minHeight: 110, padding: 6, cursor: "pointer",
                          background: isSelected ? "linear-gradient(160deg,rgba(33,208,179,0.10),rgba(33,208,179,0.03))" : isToday ? "linear-gradient(160deg,rgba(31,205,255,0.08),#fff)" : SURFACE.card,
                          border: `1px solid ${SURFACE.borderMuted}`,
                          opacity: isCurrentMonth ? 1 : 0.4,
                        }}>
                        <div className="flex items-center justify-between">
                          <span style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 22, height: 22, borderRadius: "50%",
                            fontSize: 11, fontWeight: isToday ? 800 : 600,
                            background: isToday ? `linear-gradient(135deg, ${BRAND.teal}, #1eb19a)` : "transparent",
                            color: isToday ? SURFACE.card : isCurrentMonth ? SURFACE.text : SURFACE.textFaint,
                            boxShadow: isToday ? "0 2px 6px rgba(33,208,179,0.4)" : "none",
                          }}>{day.getDate()}</span>
                          {events.length > 0 && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: SURFACE.textMuted }}>
                              {events.length}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 space-y-1">
                          {events.slice(0, 3).map(ev => {
                            const pal2 = venueColor(ev.venueName);
                            const time = new Date(ev.scheduledAt!).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
                            return (
                              <div key={ev.id}
                                className="cal-entry"
                                onClick={(e) => { e.stopPropagation(); openEditPrueba(ev); }}
                                style={{
                                background: pal2.bg,
                                color: pal2.fg,
                                borderLeft: `3px solid ${pal2.ring}`,
                                padding: "2px 5px",
                                borderRadius: 4,
                                fontSize: 9.5,
                                fontWeight: 700,
                                lineHeight: 1.3,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                                <span style={{ opacity: 0.7 }}>{time}</span> {ev.name}
                              </div>
                            );
                          })}
                          {events.length > 3 && (
                            <p style={{ fontSize: 9, fontWeight: 700, color: SURFACE.textFaint, textAlign: "center", paddingTop: 1 }}>
                              +{events.length - 3} más
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
                </div>
              </section>
            )}

            {/* ── VISTA SEMANA */}
            {calView === "week" && (
              <section className="relative accent-strip-top animate-fade-up" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 20, overflow: "hidden", boxShadow: pal.cardShadow }}>
                {/* En móvil la semana scrollea horizontal en vez de aplastar los 7 días. */}
                <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", minWidth: "640px", paddingTop: 4 }}>
                  {week.map(day => {
                    const dk = day.toISOString().slice(0, 10);
                    const isToday = dk === todayKey;
                    const isSelected = dk === selectedDayKey;
                    const events = byDay.get(dk) || [];
                    return (
                      <div key={dk}
                        onClick={() => { setCalSelectedDay(new Date(day)); setCalDayModalOpen(true); }}
                        style={{
                          minHeight: 360, padding: 10, cursor: "pointer",
                          background: isSelected ? "rgba(33,208,179,0.05)" : SURFACE.card,
                          borderLeft: `1px solid #f1f5f9`,
                          borderTop: isToday ? `3px solid ${BRAND.teal}` : `1px solid ${SURFACE.borderMuted}`,
                        }}>
                        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: isToday ? BRAND.teal : SURFACE.textFaint }}>
                          {WEEK[(day.getDay() + 6) % 7]}
                        </p>
                        <p style={{ fontSize: 24, fontWeight: 800, color: isToday ? BRAND.teal : SURFACE.text, lineHeight: 1 }}>
                          {day.getDate()}
                        </p>
                        <p style={{ fontSize: 10, color: SURFACE.textFaint }}>
                          {events.length} prueba{events.length !== 1 ? "s" : ""}
                        </p>
                        <div className="mt-3 space-y-1.5">
                          {events.map(ev => {
                            const pal2 = venueColor(ev.venueName);
                            const time = new Date(ev.scheduledAt!).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
                            return (
                              <div key={ev.id}
                                className="cal-entry"
                                onClick={(e) => { e.stopPropagation(); openEditPrueba(ev); }}
                                style={{
                                  background: pal2.bg, color: pal2.fg,
                                  borderLeft: `3px solid ${pal2.ring}`,
                                  padding: "6px 8px", borderRadius: 6,
                                  fontSize: 10.5, fontWeight: 700, lineHeight: 1.3, cursor: "pointer",
                                }}>
                                <p style={{ fontSize: 9, opacity: 0.7, fontWeight: 800 }}>{time}</p>
                                <p style={{ marginTop: 1 }}>{ev.name}</p>
                                {ev.venueName && (
                                  <p style={{ fontSize: 9, marginTop: 2, opacity: 0.85, display: "flex", alignItems: "center", gap: 3 }}><PinIcon size={10} />{ev.venueName}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              </section>
            )}

            {/* ── VISTA DÍA (timeline horaria) */}
            {calView === "day" && (
              <section className="relative accent-strip-top animate-fade-up" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 20, padding: 18, overflow: "hidden", boxShadow: pal.cardShadow }}>
                {selectedItems.length === 0 ? (
                  <div style={{ padding: "48px 16px", textAlign: "center" }}>
                    <p style={{ marginBottom: 8, color: SURFACE.borderStrong, display: "flex", justifyContent: "center" }}><CalendarIcon size={48} /></p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: SURFACE.textSecondary }}>Sin pruebas para este día</p>
                    <p style={{ fontSize: 12, color: SURFACE.textFaint, marginTop: 4 }}>Prueba con otra fecha o saca los filtros.</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 4 }}>
                    {Array.from({ length: 16 }, (_, i) => i + 7).map(h => {
                      const items = selectedItems.filter(ev => new Date(ev.scheduledAt!).getHours() === h);
                      return (
                        <div key={h} style={{ display: "contents" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: SURFACE.textFaint, textAlign: "right", paddingRight: 8, paddingTop: 4, borderRight: `1px solid ${SURFACE.borderMuted}` }}>
                            {String(h).padStart(2, "0")}:00
                          </div>
                          <div style={{ minHeight: 36, padding: "2px 0 4px", borderBottom: `1px solid ${SURFACE.bg}` }}>
                            {items.length === 0 && <div style={{ height: 1, background: SURFACE.bg }} />}
                            {items.map(ev => {
                              const pal2 = venueColor(ev.venueName);
                              const time = new Date(ev.scheduledAt!).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
                              return (
                                <div key={ev.id}
                                  className="cal-entry"
                                  onClick={() => openEditPrueba(ev)}
                                  style={{
                                    background: pal2.bg, color: pal2.fg,
                                    borderLeft: `4px solid ${pal2.ring}`,
                                    padding: "6px 10px", borderRadius: 8, marginBottom: 4,
                                    cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                                    boxShadow: `0 2px 8px ${pal2.ring}22`,
                                  }}>
                                  <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.85, minWidth: 44 }}>{time}</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>{ev.name}</p>
                                    <p style={{ fontSize: 10, opacity: 0.85, margin: "2px 0 0" }}>
                                      {parentMap.get(ev.parentId!) ?? ""}{ev.venueName ? ` · ${ev.venueName}` : ""}
                                    </p>
                                  </div>
                                  {ev.category && (
                                    <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.5)" }}>
                                      {categoryLabel(ev.category)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ── VISTA TABLA (estilo Excel) */}
            {calView === "table" && (
              <section className="relative accent-strip-top animate-fade-up" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 20, overflow: "hidden", boxShadow: pal.cardShadow }}>
                {calendarPruebas.length === 0 ? (
                  <div style={{ padding: 48, textAlign: "center" }}>
                    <p style={{ fontSize: 14, color: SURFACE.textFaint }}>Sin pruebas que coincidan con los filtros</p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
                    <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: `linear-gradient(135deg, ${SURFACE.text}, #1e293b)`, color: SURFACE.card }}>
                          {["N°", "Día", "Hora", "Prueba", "Deporte", "Categoría", "Recinto"].map(h => (
                            <th key={h} style={{
                              padding: "10px 12px", textAlign: "left",
                              fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              borderRight: "1px solid rgba(255,255,255,0.1)",
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {calendarPruebas.map((ev, i) => {
                          const pal2 = venueColor(ev.venueName);
                          const dt = new Date(ev.scheduledAt!);
                          const dateStr = dt.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
                          const time = dt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
                          const catColor = CATEGORY_COLORS[ev.category ?? ""] ?? SURFACE.textMuted;
                          return (
                            <tr key={ev.id}
                              onClick={() => openEditPrueba(ev)}
                              style={{
                                background: i % 2 === 0 ? SURFACE.card : SURFACE.bg,
                                borderBottom: `1px solid ${SURFACE.borderMuted}`,
                                cursor: "pointer",
                                transition: "background 0.1s",
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#f0fdfa")}
                              onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? SURFACE.card : SURFACE.bg)}>
                              <td style={{ padding: "10px 12px", fontWeight: 800, color: SURFACE.textMuted, textAlign: "center", minWidth: 40 }}>{i + 1}</td>
                              <td style={{ padding: "10px 12px", fontWeight: 700, color: SURFACE.text }}>{dateStr}</td>
                              <td style={{ padding: "10px 12px", fontWeight: 800, color: BRAND.teal, fontFamily: "monospace" }}>{time}</td>
                              <td style={{ padding: "10px 12px", fontWeight: 600, color: SURFACE.text }}>{ev.name}</td>
                              <td style={{ padding: "10px 12px", color: SURFACE.textMuted }}>{parentMap.get(ev.parentId!) ?? "—"}</td>
                              <td style={{ padding: "10px 12px" }}>
                                {ev.category ? (
                                  <span style={{
                                    fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 99,
                                    background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}40`,
                                  }}>
                                    {categoryLabel(ev.category)}
                                  </span>
                                ) : <span style={{ color: SURFACE.borderStrong }}>—</span>}
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                {ev.venueName ? (
                                  <span style={{
                                    display: "inline-block",
                                    padding: "4px 10px", borderRadius: 6,
                                    background: pal2.bg, color: pal2.fg,
                                    fontWeight: 800, fontSize: 11,
                                    border: `1.5px solid ${pal2.ring}`,
                                    whiteSpace: "nowrap",
                                  }}>
                                    {ev.venueName}
                                  </span>
                                ) : <span style={{ color: SURFACE.borderStrong }}>—</span>}
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

            {/* Detalle del día (visible siempre que NO sea vista día/tabla) */}
            {(calView === "month" || calView === "week") && (
              <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 16, padding: 16, boxShadow: pal.cardShadow }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND.teal, margin: 0 }}>
                      {selectedDayLabel} · {selectedItems.length} prueba{selectedItems.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {selectedItems.length > 0 && (
                    <button onClick={() => setCalView("day")} className="btn btn-ghost text-xs">
                      Ver agenda del día →
                    </button>
                  )}
                </div>
                {selectedItems.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: SURFACE.textFaint, marginTop: 8 }}>Sin pruebas este día</p>
                ) : (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {selectedItems.map(prueba => {
                      const pal2 = venueColor(prueba.venueName);
                      const time = new Date(prueba.scheduledAt!).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={prueba.id}
                          onClick={() => openEditPrueba(prueba)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: 10, borderRadius: 12,
                            background: pal2.bg, color: pal2.fg,
                            borderLeft: `4px solid ${pal2.ring}`,
                            cursor: "pointer", transition: "transform 0.1s",
                            boxShadow: `0 1px 4px ${pal2.ring}22`,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
                          onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
                          <span style={{ fontSize: 13, fontWeight: 800, minWidth: 50, fontFamily: "monospace" }}>{time}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prueba.name}</p>
                            <p style={{ fontSize: 10.5, opacity: 0.85, margin: "2px 0 0" }}>
                              {parentMap.get(prueba.parentId!) ?? ""}{prueba.venueName ? ` · ${prueba.venueName}` : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Popup dinámico del día */}
            {calDayModalOpen && (
              <div
                className="animate-fade-in"
                style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(5px)" }}
                onClick={() => setCalDayModalOpen(false)}
              >
                <div
                  className="anim-scale-pop"
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: "100%", maxWidth: 560, maxHeight: "88vh", display: "flex", flexDirection: "column", background: SURFACE.card, borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 60px rgba(15,23,42,0.35)" }}
                >
                  {/* Header */}
                  <div style={{ position: "relative", padding: "18px 20px", background: `linear-gradient(135deg, ${BRAND.teal} 0%, ${BRAND.blue} 100%)`, overflow: "hidden" }}>
                    <div className="ambient-orb" style={{ width: 160, height: 160, top: -60, right: -40, background: "radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 65%)" }} />
                    <div className="relative flex items-start justify-between gap-3">
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)" }}>Agenda del día</p>
                        <h3 style={{ marginTop: 2, fontSize: 18, fontWeight: 800, color: SURFACE.card, textTransform: "capitalize", lineHeight: 1.2 }}>{selectedDayLabel}</h3>
                        <p style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                          {selectedItems.length} {selectedItems.length === 1 ? "prueba" : "pruebas"}
                        </p>
                      </div>
                      <button type="button" onClick={() => setCalDayModalOpen(false)} aria-label="Cerrar"
                        style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.2)", color: SURFACE.card, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                        <XIcon size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Cuerpo */}
                  <div className="stagger" style={{ padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                    {selectedItems.length === 0 ? (
                      <div style={{ padding: "32px 16px", textAlign: "center" }}>
                        <p style={{ marginBottom: 6, color: SURFACE.borderStrong, display: "flex", justifyContent: "center" }}><CalendarIcon size={40} /></p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: SURFACE.textSecondary }}>Sin pruebas para este día</p>
                        <p style={{ fontSize: 12, color: SURFACE.textFaint, marginTop: 4 }}>Prueba con otra fecha o saca los filtros.</p>
                      </div>
                    ) : selectedItems.map((prueba) => {
                      const pal2 = venueColor(prueba.venueName);
                      const time = new Date(prueba.scheduledAt!).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={prueba.id}
                          className="cal-entry"
                          onClick={() => { openEditPrueba(prueba); setCalDayModalOpen(false); }}
                          style={{ background: pal2.bg, color: pal2.fg, borderLeft: `4px solid ${pal2.ring}`, borderRadius: 12, padding: "12px 14px", boxShadow: `0 2px 10px ${pal2.ring}22`, display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, minWidth: 52, fontFamily: "monospace" }}>{time}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prueba.name}</p>
                            <p style={{ fontSize: 11, opacity: 0.85, margin: "2px 0 0" }}>
                              {parentMap.get(prueba.parentId!) ?? ""}{prueba.venueName ? ` · ${prueba.venueName}` : ""}
                            </p>
                          </div>
                          {prueba.category && (
                            <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,0.55)" }}>
                              {categoryLabel(prueba.category)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div style={{ padding: "12px 16px", borderTop: `1px solid ${SURFACE.border}`, display: "flex", justifyContent: "space-between", gap: 10, background: SURFACE.bg }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setCalDayModalOpen(false)}>Cerrar</button>
                    {selectedItems.length > 0 && (
                      <button type="button" className="btn btn-primary" onClick={() => { setCalDayModalOpen(false); setCalView("day"); }}>
                        Ver agenda del día →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Modal: detalle de una barra del Gantt ── */}
            {ganttBar && (
              <div
                className="animate-fade-in"
                style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(5px)" }}
                onClick={() => setGanttBar(null)}
              >
                <div
                  className="anim-scale-pop"
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: "100%", maxWidth: 560, maxHeight: "88vh", display: "flex", flexDirection: "column", background: SURFACE.card, borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 60px rgba(15,23,42,0.35)" }}
                >
                  {/* Header */}
                  <div style={{ position: "relative", padding: "18px 20px", background: `linear-gradient(135deg, ${ganttBar.color} 0%, ${ganttBar.color}cc 100%)`, overflow: "hidden" }}>
                    <div className="ambient-orb" style={{ width: 160, height: 160, top: -60, right: -40, background: "radial-gradient(circle, rgba(255,255,255,0.30) 0%, transparent 65%)" }} />
                    <div className="relative flex items-start justify-between gap-3">
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)" }}>{ganttBar.cat}</p>
                        <h3 style={{ marginTop: 2, fontSize: 18, fontWeight: 700, color: SURFACE.card, lineHeight: 1.2 }}>{ganttBar.title}</h3>
                        <p style={{ marginTop: 4, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>
                          {ganttBar.events.length} {ganttBar.events.length === 1 ? "prueba" : "pruebas"}
                        </p>
                      </div>
                      <button type="button" onClick={() => setGanttBar(null)} aria-label="Cerrar"
                        style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.2)", color: SURFACE.card, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                        <XIcon size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Cuerpo */}
                  <div className="stagger" style={{ padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                    {ganttBar.events.map((prueba) => {
                      const pal2 = venueColor(prueba.venueName);
                      const dt = new Date(prueba.scheduledAt!);
                      const fecha = dt.toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "short" });
                      const hora = dt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={prueba.id}
                          className="cal-entry"
                          onClick={() => { openEditPrueba(prueba); setGanttBar(null); }}
                          style={{ background: pal2.bg, color: pal2.fg, borderLeft: `4px solid ${pal2.ring}`, borderRadius: 12, padding: "12px 14px", boxShadow: `0 2px 10px ${pal2.ring}22`, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                          <div style={{ minWidth: 60, textAlign: "center" }}>
                            <p style={{ fontSize: 11, fontWeight: 600, margin: 0, textTransform: "capitalize" }}>{fecha}</p>
                            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, fontFamily: "monospace" }}>{hora}</p>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prueba.name}</p>
                            <p style={{ fontSize: 11, opacity: 0.85, margin: "2px 0 0" }}>
                              {parentMap.get(prueba.parentId!) ?? ""}{prueba.venueName ? ` · ${prueba.venueName}` : ""}
                            </p>
                          </div>
                          {prueba.category && (
                            <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,0.55)" }}>
                              {categoryLabel(prueba.category)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div style={{ padding: "12px 16px", borderTop: `1px solid ${SURFACE.border}`, display: "flex", justifyContent: "space-between", gap: 10, background: SURFACE.bg, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: SURFACE.textFaint }}>Toca una prueba para editarla</span>
                    <button type="button" className="btn btn-ghost" onClick={() => setGanttBar(null)}>Cerrar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Prueba modal */}
      {pruebaModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", padding: "16px" }}>
          <div style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "20px", padding: isMobile ? "16px" : "24px", width: "100%", maxWidth: "560px", maxHeight: "calc(100dvh - 32px)", overflowY: "auto", boxShadow: "0 8px 40px rgba(15,23,42,0.15)" }}>
            <h2 style={{ fontWeight: 700, fontSize: "18px", color: SURFACE.text, marginBottom: "4px" }}>
              {pruebaModal.editing ? t("Editar prueba") : t("Nueva prueba")}
            </h2>
            <p style={{ fontSize: "12px", color: SURFACE.textFaint, marginBottom: "20px" }}>
              {eventDisciplines.find(d => d.id === pruebaModal.parentId)?.name ?? ""}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: SURFACE.textFaint }}>{t("Nombre *")}</span>
                <input
                  style={fieldStyle}
                  value={pruebaForm.name}
                  onChange={e => setPruebaForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ej: 100 metros planos"
                  autoFocus
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: SURFACE.textFaint }}>{t("Categoría")}</span>
                  <StyledSelect value={pruebaForm.category} onChange={e => setPruebaForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">—</option>
                    <option value="CONVENTIONAL">{t("Convencional")}</option>
                    <option value="PARALYMPIC">{t("Paralímpica")}</option>
                  </StyledSelect>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: SURFACE.textFaint }}>{t("Género")}</span>
                  <StyledSelect value={pruebaForm.gender} onChange={e => setPruebaForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="">—</option>
                    <option value="MALE">{t("Masculino")}</option>
                    <option value="FEMALE">{t("Femenino")}</option>
                    <option value="MIXED">{t("Mixto")}</option>
                  </StyledSelect>
                </label>
              </div>

              {/* Date range toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <button type="button" onClick={() => setPruebaForm(f => ({ ...f, useDateRange: !f.useDateRange }))}
                  style={{ width: 38, height: 20, borderRadius: 10, border: "none", cursor: "pointer", position: "relative", background: pruebaForm.useDateRange ? BRAND.teal : SURFACE.borderStrong, transition: "background 0.2s" }}>
                  <span style={{ position: "absolute", top: 2, left: pruebaForm.useDateRange ? 20 : 2, width: 16, height: 16, borderRadius: 8, background: SURFACE.card, boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
                </button>
                <span style={{ fontSize: 12, fontWeight: 600, color: SURFACE.text }}>{t("Rango de fechas (varios días, misma hora)")}</span>
              </div>

              {pruebaForm.useDateRange ? (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "10px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: SURFACE.textFaint }}>{t("Fecha inicio")}</span>
                    <input style={fieldStyle} type="date" value={pruebaForm.rangeStart} onChange={e => setPruebaForm(f => ({ ...f, rangeStart: e.target.value }))} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: SURFACE.textFaint }}>{t("Fecha fin")}</span>
                    <input style={fieldStyle} type="date" value={pruebaForm.rangeEnd} onChange={e => setPruebaForm(f => ({ ...f, rangeEnd: e.target.value }))} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: SURFACE.textFaint }}>{t("Hora")}</span>
                    <input style={fieldStyle} type="time" value={pruebaForm.rangeTime} onChange={e => setPruebaForm(f => ({ ...f, rangeTime: e.target.value }))} />
                  </label>
                </div>
              ) : (
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: SURFACE.textFaint }}>{t("Fecha y hora")}</span>
                  <input style={fieldStyle} type="datetime-local" value={pruebaForm.scheduledAt} onChange={e => setPruebaForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                </label>
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: SURFACE.textFaint }}>{t("Recinto")}</span>
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

              {/* Delegaciones que participan: un partido lleva las dos regiones;
                  sin delegaciones la prueba es general y la ven todas. */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: SURFACE.textFaint }}>{t("Delegaciones que participan")}</span>
                {pruebaForm.delegationIds.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {pruebaForm.delegationIds.map((id) => {
                      const deleg = delegations.find((x) => x.id === id);
                      return (
                        <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: BRAND.teal, background: "rgba(33,208,179,0.10)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "3px 10px" }}>
                          {deleg ? nombreCortoRegion(delegationLabel(deleg)) : id}
                          <button type="button" aria-label={t("Quitar") as string}
                            onClick={() => setPruebaForm(f => ({ ...f, delegationIds: f.delegationIds.filter((x) => x !== id) }))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: BRAND.teal, padding: 0, fontSize: "13px", lineHeight: 1 }}>×</button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <StyledSelect value="" onChange={e => { const id = e.target.value; if (id) setPruebaForm(f => ({ ...f, delegationIds: f.delegationIds.includes(id) ? f.delegationIds : [...f.delegationIds, id] })); }}>
                  <option value="">{pruebaForm.delegationIds.length === 0 ? t("Prueba general (todas las delegaciones)") : t("Agregar delegación…")}</option>
                  {eventDelegations
                    .filter((d) => !pruebaForm.delegationIds.includes(d.id))
                    .map((d) => <option key={d.id} value={d.id}>{delegationLabel(d) || d.countryCode || d.id}</option>)}
                </StyledSelect>
              </div>

              {/* ───── Ceremonia de premiación ───── */}
              <div style={{ borderTop: `1px dashed ${SURFACE.border}`, paddingTop: "12px", marginTop: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPremiacion(p => ({ ...p, enabled: !p.enabled }))}
                    style={{ width: 38, height: 20, borderRadius: 10, border: "none", cursor: "pointer", position: "relative", background: premiacion.enabled ? BRAND.teal : SURFACE.borderStrong, transition: "background 0.2s" }}
                  >
                    <span style={{ position: "absolute", top: 2, left: premiacion.enabled ? 20 : 2, width: 16, height: 16, borderRadius: 8, background: SURFACE.card, boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text }}>{t("Esta prueba tiene ceremonia de premiación")}</span>
                </div>

                {premiacion.enabled && (
                  <div style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, borderRadius: 12, padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: SURFACE.textFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Fecha y hora ceremonia")}</span>
                        <input style={fieldStyle} type="datetime-local" value={premiacion.scheduledAt} onChange={e => setPremiacion(p => ({ ...p, scheduledAt: e.target.value }))} />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: SURFACE.textFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Sede")}</span>
                        <select style={fieldStyle} value={premiacion.venueName} onChange={e => setPremiacion(p => ({ ...p, venueName: e.target.value }))}>
                          <option value="">{t("Usa la misma de la prueba")}</option>
                          {venueOptions.map((v) => (
                            <option key={v.id} value={v.name}>{v.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: SURFACE.textFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Ubicación específica")}</span>
                      <input style={fieldStyle} placeholder={t("Zona central — Tarima 1") as string} value={premiacion.locationDetail} onChange={e => setPremiacion(p => ({ ...p, locationDetail: e.target.value }))} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: SURFACE.textFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Notas")}</span>
                      <textarea rows={2} style={{ ...fieldStyle, resize: "none" }} placeholder={t("Instrucciones para los premiadores") as string} value={premiacion.notes} onChange={e => setPremiacion(p => ({ ...p, notes: e.target.value }))} />
                    </label>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: SURFACE.textMuted }}>{t("Equipo de premiadores (VIP)")}</span>
                        <button
                          type="button"
                          onClick={() => setPremiacion(p => ({ ...p, awarders: [...p.awarders, { athleteId: "", role: "AWARDER" }] }))}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, border: `1px solid ${BRAND.teal}`, background: "rgba(33,208,179,0.08)", color: BRAND.teal, cursor: "pointer", fontWeight: 700 }}
                        >
                          + {t("Agregar VIP")}
                        </button>
                      </div>
                      {premiacion.awarders.length === 0 && (
                        <p style={{ fontSize: 11, color: SURFACE.textFaint, padding: "8px", textAlign: "center", border: `1px dashed ${SURFACE.border}`, borderRadius: 8 }}>
                          {t("Sin VIPs asignados. Agrega al menos uno.")}
                        </p>
                      )}
                      {premiacion.awarders.map((a, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1.4fr) minmax(0, 1fr) auto" : "2fr 1fr auto", gap: 6, marginBottom: 4 }}>
                          <select
                            style={fieldStyle}
                            value={a.athleteId}
                            onChange={e => setPremiacion(p => {
                              const next = [...p.awarders];
                              next[i] = { ...next[i], athleteId: e.target.value };
                              return { ...p, awarders: next };
                            })}
                          >
                            <option value="">— VIP —</option>
                            {vipAthletes.map(x => (
                              <option key={x.id} value={x.id}>{x.fullName || x.id.slice(0, 8)}</option>
                            ))}
                          </select>
                          <select
                            style={fieldStyle}
                            value={a.role}
                            onChange={e => setPremiacion(p => {
                              const next = [...p.awarders];
                              next[i] = { ...next[i], role: e.target.value };
                              return { ...p, awarders: next };
                            })}
                          >
                            {PREMIACION_ROLES.map(r => (<option key={r.value} value={r.value}>{r.label}</option>))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setPremiacion(p => ({ ...p, awarders: p.awarders.filter((_, j) => j !== i) }))}
                            style={{ padding: "6px 10px", border: "none", background: STATE.dangerSoft, color: STATE.danger, borderRadius: 6, cursor: "pointer", fontSize: 12 }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {pruebaError && <p style={{ marginTop: "12px", fontSize: "13px", color: STATE.danger }}>{pruebaError}</p>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "20px" }}>
              <button style={ghostBtn} onClick={() => setPruebaModal(null)} disabled={pruebaSaving}>{t("Cancelar")}</button>
              <button style={{ ...primaryBtn, opacity: pruebaSaving ? 0.7 : 1 }} onClick={savePrueba} disabled={pruebaSaving}>
                {pruebaSaving ? t("Guardando…") : t("Guardar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete prueba confirmation modal */}
      {deletePruebaConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", padding: "16px" }}>
          <div style={{ background: SURFACE.card, borderRadius: "20px", width: "100%", maxWidth: "380px", padding: isMobile ? "20px" : "28px", maxHeight: "calc(100dvh - 32px)", overflowY: "auto", boxShadow: "0 8px 40px rgba(15,23,42,0.2)", textAlign: "center" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <TrashIcon size={24} color={STATE.danger} strokeWidth={2} />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: SURFACE.text, margin: "0 0 6px" }}>Eliminar prueba</h3>
            <p style={{ fontSize: "13px", color: SURFACE.textMuted, margin: "0 0 20px" }}>
              ¿Estás seguro de eliminar <b style={{ color: SURFACE.text }}>{deletePruebaConfirm.name}</b>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => setDeletePruebaConfirm(null)}
                style={{ padding: "10px 24px", borderRadius: "10px", border: `1px solid ${SURFACE.border}`, background: SURFACE.card, color: SURFACE.textMuted, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={() => removePrueba(deletePruebaConfirm)}
                style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: `linear-gradient(135deg, ${STATE.danger}, ${STATE.dangerText})`, color: SURFACE.card, fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(239,68,68,0.3)" }}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
