"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import { TrophyIcon, CalendarIcon, CheckIcon, AlertIcon, PlusIcon } from "@/components/ui/Icons";

type Awarder = {
  id?: string;
  athleteId: string;
  role?: string | null;
  confirmedAt?: string | null;
  declinedAt?: string | null;
};

type Premiacion = {
  id: string;
  title: string;
  discipline?: string | null;
  disciplineId?: string | null;
  scheduledAt: string;
  venueName?: string | null;
  locationDetail?: string | null;
  status: "PROGRAMADA" | "REALIZADA" | string;
  notes?: string | null;
  awarders?: Awarder[] | null;
};

type Athlete = { id: string; fullName: string };
type Discipline = {
  id: string;
  name: string;
  category?: string | null;
  gender?: string | null;
  parentId?: string | null;
  scheduledAt?: string | null;
  venueName?: string | null;
};
type Venue = { id: string; name: string };

type NewPremiacionForm = {
  disciplineId: string;
  title: string;
  scheduledAt: string;
  venueId: string;
  venueName: string;
  locationDetail: string;
  notes: string;
  awarders: Array<{ athleteId: string; role: string }>;
};

const EMPTY_FORM: NewPremiacionForm = {
  disciplineId: "",
  title: "",
  scheduledAt: "",
  venueId: "",
  venueName: "",
  locationDetail: "",
  notes: "",
  awarders: [],
};

const AWARDER_ROLES = [
  { value: "GOLD", label: "Oro" },
  { value: "SILVER", label: "Plata" },
  { value: "BRONZE", label: "Bronce" },
  { value: "AUTHORITY", label: "Autoridad" },
  { value: "AWARDER", label: "Entregador" },
];

const GENDER_LABELS: Record<string, string> = {
  MALE: "Masculino",
  M: "Masculino",
  MASCULINE: "Masculino",
  MASCULINO: "Masculino",
  FEMALE: "Femenino",
  F: "Femenino",
  FEMININE: "Femenino",
  FEMENINO: "Femenino",
  MIXED: "Mixto",
  MIX: "Mixto",
  MIXTO: "Mixto",
  UNISEX: "Unisex",
  OPEN: "Abierto",
};

const CATEGORY_LABELS: Record<string, string> = {
  CONVENTIONAL: "Convencional",
  PARALYMPIC: "Paralímpica",
  CONVENCIONAL: "Convencional",
  PARALIMPICA: "Paralímpica",
  ADULT: "Adulto",
  ADULTO: "Adulto",
  SENIOR: "Senior",
  JUNIOR: "Junior",
  YOUTH: "Juvenil",
  JUVENIL: "Juvenil",
  KIDS: "Infantil",
  INFANTIL: "Infantil",
  MASTERS: "Masters",
  PROFESSIONAL: "Profesional",
  PROFESIONAL: "Profesional",
  AMATEUR: "Amateur",
};

const labelOf = (map: Record<string, string>, value?: string | null) => {
  const v = String(value || "").trim().toUpperCase();
  return map[v] || value || "";
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  GOLD: { label: "Oro", color: "#d4a017" },
  SILVER: { label: "Plata", color: "#9aa0a6" },
  BRONZE: { label: "Bronce", color: "#a0522d" },
  AUTHORITY: { label: "Autoridad", color: "#1f4e8c" },
  AWARDER: { label: "Entregador", color: "#5e6b7a" },
};

function fmtDateKey(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateLong(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDayShort(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getWeekDays(dateStr: string): string[] {
  const base = new Date(dateStr);
  const day = base.getDay() || 7; // domingo=0 → 7
  const monday = new Date(base);
  monday.setDate(base.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export default function PremiacionesCalendarPage() {
  const [premiaciones, setPremiaciones] = useState<Premiacion[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [view, setView] = useState<"day" | "week" | "list">("list");
  const [date, setDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<"" | "PROGRAMADA" | "REALIZADA">("");
  const [disciplineFilter, setDisciplineFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [venueFilter, setVenueFilter] = useState("");

  // Modal "Nueva premiación"
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NewPremiacionForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Filtros internos del modal (cascada: deporte → categoría → género → prueba)
  const [filterSportId, setFilterSportId] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterGender, setFilterGender] = useState("");

  // Deportes (raíz)
  const allSports = useMemo(
    () => disciplines.filter((d) => !d.parentId),
    [disciplines],
  );
  // Alias mantenido para uso interno (selectDiscipline)
  const sports = allSports;

  // Pruebas filtradas en cascada: Género → Categoría → Deporte
  const filteredDisciplines = useMemo(() => {
    return disciplines
      .filter((d) => !!d.parentId) // solo pruebas, no deportes
      .filter((d) => (filterGender ? d.gender === filterGender : true))
      .filter((d) => (filterCategory ? d.category === filterCategory : true))
      .filter((d) => (filterSportId ? d.parentId === filterSportId : true));
  }, [disciplines, filterGender, filterCategory, filterSportId]);

  // Opciones disponibles para los filtros, en orden de cascada:
  // Género (toma todas las pruebas), Categoría (depende de género),
  // Deporte (depende de género + categoría).
  const availableGenders = useMemo(() => {
    const set = new Set<string>();
    disciplines
      .filter((d) => !!d.parentId)
      .forEach((d) => d.gender && set.add(d.gender));
    return Array.from(set).sort();
  }, [disciplines]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    disciplines
      .filter((d) => !!d.parentId)
      .filter((d) => (filterGender ? d.gender === filterGender : true))
      .forEach((d) => d.category && set.add(d.category));
    return Array.from(set).sort();
  }, [disciplines, filterGender]);

  const availableSports = useMemo(() => {
    const sportIds = new Set<string>();
    disciplines
      .filter((d) => !!d.parentId)
      .filter((d) => (filterGender ? d.gender === filterGender : true))
      .filter((d) => (filterCategory ? d.category === filterCategory : true))
      .forEach((d) => d.parentId && sportIds.add(d.parentId));
    return allSports.filter((s) => sportIds.has(s.id));
  }, [disciplines, filterGender, filterCategory, allSports]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, ath, disc, ven] = await Promise.all([
        apiFetch<Premiacion[]>("/premiaciones"),
        apiFetch<Athlete[]>("/athletes"),
        apiFetch<Discipline[]>("/disciplines"),
        apiFetch<Venue[]>("/venues").catch(() => [] as Venue[]),
      ]);
      setPremiaciones(Array.isArray(list) ? list : []);
      setAthletes(Array.isArray(ath) ? ath : []);
      setDisciplines(Array.isArray(disc) ? disc : []);
      setVenues(Array.isArray(ven) ? ven : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const athleteName = useMemo(() => {
    const map = new Map<string, string>();
    athletes.forEach((a) => map.set(a.id, a.fullName));
    return (id: string) => map.get(id) || id.slice(0, 8);
  }, [athletes]);

  // Filtros por fecha (solo aplican en vistas día/semana, no en lista)
  const filtered = useMemo(() => {
    if (view === "list") return premiaciones;
    const base = new Date(date);
    if (view === "day") {
      const key = fmtDateKey(date);
      return premiaciones.filter((p) => fmtDateKey(p.scheduledAt) === key);
    }
    // semana: lunes a domingo
    const day = base.getDay() || 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);
    return premiaciones.filter((p) => {
      const d = new Date(p.scheduledAt);
      return d >= monday && d < sunday;
    });
  }, [premiaciones, view, date]);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return filtered
      .filter((p) => (statusFilter ? p.status === statusFilter : true))
      .filter((p) =>
        disciplineFilter
          ? String(p.discipline || "").toLowerCase() === disciplineFilter.toLowerCase()
          : true,
      )
      .filter((p) =>
        venueFilter ? String(p.venueName || "").toLowerCase() === venueFilter.toLowerCase() : true,
      )
      .filter((p) => {
        if (!q) return true;
        return (
          String(p.title || "").toLowerCase().includes(q) ||
          String(p.discipline || "").toLowerCase().includes(q) ||
          String(p.venueName || "").toLowerCase().includes(q) ||
          String(p.locationDetail || "").toLowerCase().includes(q) ||
          String(p.notes || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [filtered, statusFilter, disciplineFilter, venueFilter, searchQuery]);

  // Disciplinas únicas presentes en las premiaciones (para el dropdown del filtro)
  const disciplineOptions = useMemo(() => {
    const set = new Set<string>();
    premiaciones.forEach((p) => p.discipline && set.add(p.discipline));
    return Array.from(set).sort();
  }, [premiaciones]);

  const venueOptions = useMemo(() => {
    const set = new Set<string>();
    premiaciones.forEach((p) => p.venueName && set.add(p.venueName));
    return Array.from(set).sort();
  }, [premiaciones]);

  // Conteos totales para los chips de estado
  const totalsByStatus = useMemo(() => {
    let prog = 0, real = 0;
    for (const p of premiaciones) {
      if (p.status === "REALIZADA") real++;
      else if (p.status === "PROGRAMADA") prog++;
    }
    return { all: premiaciones.length, programada: prog, realizada: real };
  }, [premiaciones]);

  // Agrupado por fecha para la vista lista
  const listGrouped = useMemo(() => {
    if (view !== "list") return [] as Array<{ date: string; items: Premiacion[] }>;
    const map = new Map<string, Premiacion[]>();
    visible.forEach((p) => {
      const k = fmtDateKey(p.scheduledAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, items]) => ({ date: d, items }));
  }, [visible, view]);

  const hasActiveFilters = !!(statusFilter || disciplineFilter || venueFilter || searchQuery);
  const clearFilters = () => {
    setStatusFilter("");
    setDisciplineFilter("");
    setVenueFilter("");
    setSearchQuery("");
  };

  // Agrupar por día para vista semanal
  const grouped = useMemo(() => {
    if (view === "day") return new Map([[fmtDateKey(date), visible]]);
    const map = new Map<string, Premiacion[]>();
    visible.forEach((p) => {
      const k = fmtDateKey(p.scheduledAt);
      const list = map.get(k) || [];
      list.push(p);
      map.set(k, list);
    });
    return map;
  }, [visible, view, date]);

  // Métricas
  const metrics = useMemo(() => {
    const total = visible.length;
    const realizadas = visible.filter((p) => p.status === "REALIZADA").length;
    const programadas = total - realizadas;
    const sinEntregadores = visible.filter((p) => !p.awarders || p.awarders.length === 0).length;
    return { total, realizadas, programadas, sinEntregadores };
  }, [visible]);

  const toggleStatus = async (p: Premiacion) => {
    const next = p.status === "REALIZADA" ? "PROGRAMADA" : "REALIZADA";
    try {
      await apiFetch(`/premiaciones/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      setMessage(`Premiación marcada como ${next}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar");
    }
  };

  const confirmAwarder = async (premiacionId: string, awarderId: string, action: "confirm" | "decline") => {
    try {
      await apiFetch(`/premiaciones/${premiacionId}/awarders/${awarderId}/${action}`, {
        method: "PATCH",
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en confirmación");
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  };

  const openCreateModal = (preselectedDate?: string) => {
    const defaultDateTime = preselectedDate
      ? `${preselectedDate}T10:00`
      : `${date}T10:00`;
    setForm({ ...EMPTY_FORM, scheduledAt: defaultDateTime });
    setFilterSportId("");
    setFilterCategory("");
    setFilterGender("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(EMPTY_FORM);
    setFilterSportId("");
    setFilterCategory("");
    setFilterGender("");
  };

  // Al elegir la prueba, auto-completar título, fecha y venue si la disciplina los tiene
  const selectDiscipline = (id: string) => {
    if (!id) {
      setForm((f) => ({ ...f, disciplineId: "" }));
      return;
    }
    const d = disciplines.find((x) => x.id === id);
    if (!d) {
      setForm((f) => ({ ...f, disciplineId: id }));
      return;
    }
    const sport = sports.find((s) => s.id === d.parentId);
    const parts = [
      "Premiación",
      sport?.name,
      d.name,
      d.category ? labelOf(CATEGORY_LABELS, d.category) : null,
      d.gender ? labelOf(GENDER_LABELS, d.gender) : null,
    ].filter(Boolean);
    const suggestedTitle = parts.join(" — ");
    const scheduledLocal = d.scheduledAt
      ? new Date(d.scheduledAt).toISOString().slice(0, 16)
      : "";
    setForm((f) => ({
      ...f,
      disciplineId: id,
      title: f.title || suggestedTitle,
      scheduledAt: scheduledLocal || f.scheduledAt,
      venueName: d.venueName || f.venueName,
    }));
  };

  const setFormField = <K extends keyof NewPremiacionForm>(
    key: K,
    value: NewPremiacionForm[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const addAwarder = () =>
    setForm((f) => ({
      ...f,
      awarders: [...f.awarders, { athleteId: "", role: "AWARDER" }],
    }));

  const updateAwarder = (idx: number, key: "athleteId" | "role", value: string) =>
    setForm((f) => ({
      ...f,
      awarders: f.awarders.map((aw, i) => (i === idx ? { ...aw, [key]: value } : aw)),
    }));

  const removeAwarder = (idx: number) =>
    setForm((f) => ({
      ...f,
      awarders: f.awarders.filter((_, i) => i !== idx),
    }));

  const submitCreate = async () => {
    if (!form.disciplineId) {
      setError("Seleccioná una prueba/disciplina");
      return;
    }
    if (!form.title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    if (!form.scheduledAt) {
      setError("La fecha/hora es obligatoria");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        disciplineId: form.disciplineId,
        title: form.title.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        status: "PROGRAMADA",
        notes: form.notes || undefined,
        venueId: form.venueId || undefined,
        venueName: form.venueName || undefined,
        locationDetail: form.locationDetail || undefined,
        awarders: form.awarders.filter((a) => a.athleteId).map((a) => ({
          athleteId: a.athleteId,
          role: a.role,
        })),
      };
      await apiFetch("/premiaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage("Premiación creada correctamente.");
      closeModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear premiación");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title="Calendario de Premiaciones"
        description="Vista consolidada de las ceremonias de premiación. Filtrá por día/semana, estado y disciplina."
        icon={<TrophyIcon size={28} />}
        iconBg="linear-gradient(135deg, #d4a017 0%, #f5c842 50%, #e3a808 100%)"
        accentStrip="gold"
        action={
          <button className="btn btn-primary" type="button" onClick={() => openCreateModal()}>
            <PlusIcon size={16} className="inline-block mr-1" />
            Nueva premiación
          </button>
        }
      />

      {/* KPIs */}
      {visible.length > 0 && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
          <KpiCard label="Total"
            value={metrics.total}
            icon={<TrophyIcon size={18} />} accent="blue" />
          <KpiCard label="Programadas"
            value={metrics.programadas}
            detail={view === "day" ? "Para este día" : "Para esta semana"}
            icon={<CalendarIcon size={18} />} accent="amber" />
          <KpiCard label="Realizadas"
            value={metrics.realizadas}
            icon={<CheckIcon size={18} />} accent="green" />
          <KpiCard label="Sin entregadores"
            value={metrics.sinEntregadores}
            detail={metrics.sinEntregadores > 0 ? "Requieren atención" : "Todo OK"}
            icon={<AlertIcon size={18} />}
            accent={metrics.sinEntregadores > 0 ? "red" : "green"} />
        </section>
      )}

      {/* Filtros y navegación */}
      <section className="surface-premium p-4 space-y-3 anim-fade-up-soft relative overflow-hidden">
        <div className="ambient-orb" style={{ width: 180, height: 180, top: -60, left: -40, background: "radial-gradient(circle, rgba(212,160,23,0.08) 0%, transparent 65%)" }} />

        {/* Selector de vista (segmented) + búsqueda */}
        <div className="flex flex-wrap items-stretch gap-2 relative">
          <div className="inline-flex items-center rounded-xl p-1 gap-0.5"
            style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
            {([
              { key: "list" as const, label: "Lista", icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/></svg>
              )},
              { key: "day" as const, label: "Día", icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              )},
              { key: "week" as const, label: "Semana", icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="22"/><line x1="13" y1="14" x2="13" y2="22"/><line x1="18" y1="14" x2="18" y2="22"/></svg>
              )},
            ]).map((opt) => {
              const active = view === opt.key;
              return (
                <button key={opt.key} type="button" onClick={() => setView(opt.key)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: active ? "linear-gradient(135deg, #d4a017 0%, #f5c842 100%)" : "transparent",
                    color: active ? "#fff" : "#64748b",
                    boxShadow: active ? "0 3px 10px rgba(212,160,23,0.32)" : "none",
                  }}>
                  {opt.icon}{opt.label}
                </button>
              );
            })}
          </div>

          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[240px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por título, disciplina, recinto, notas…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", padding: "10px 36px 10px 36px", borderRadius: 10,
                border: "1px solid #e2e8f0", background: "#fff",
                fontSize: 13, color: "#0f172a", outline: "none",
              }}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")}
                title="Limpiar búsqueda"
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          {/* Disciplina */}
          <select value={disciplineFilter} onChange={(e) => setDisciplineFilter(e.target.value)}
            className="text-sm"
            style={{
              padding: "9px 12px", borderRadius: 10, border: "1px solid #e2e8f0",
              background: "#fff", color: "#0f172a", fontSize: 13, minWidth: 170,
            }}>
            <option value="">Todas las disciplinas</option>
            {disciplineOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Recinto */}
          <select value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)}
            className="text-sm"
            style={{
              padding: "9px 12px", borderRadius: 10, border: "1px solid #e2e8f0",
              background: "#fff", color: "#0f172a", fontSize: 13, minWidth: 170,
            }}>
            <option value="">Todos los recintos</option>
            {venueOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-2 relative">
          {([
            { key: "" as const,            label: "Todas",       count: totalsByStatus.all,        color: "#475569" },
            { key: "PROGRAMADA" as const,  label: "Programadas", count: totalsByStatus.programada, color: "#c78c00" },
            { key: "REALIZADA" as const,   label: "Realizadas",  count: totalsByStatus.realizada,  color: "#2e7d32" },
          ]).map((opt) => {
            const active = statusFilter === opt.key;
            return (
              <button key={opt.key || "all"} type="button"
                onClick={() => setStatusFilter(opt.key)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={{
                  background: active ? `${opt.color}15` : "transparent",
                  color: active ? opt.color : "#64748b",
                  border: `1px solid ${active ? opt.color : "#e2e8f0"}`,
                }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: opt.color, boxShadow: active ? `0 0 0 3px ${opt.color}22` : "none" }} />
                {opt.label}
                <span className="inline-flex items-center justify-center text-[10px] font-bold rounded-md"
                  style={{
                    background: active ? `${opt.color}28` : "#f1f5f9",
                    color: active ? opt.color : "#64748b",
                    padding: "1px 6px", minWidth: 22,
                  }}>
                  {opt.count}
                </span>
              </button>
            );
          })}

          {hasActiveFilters && (
            <button type="button" onClick={clearFilters}
              className="text-xs font-semibold underline"
              style={{ color: "#64748b", marginLeft: 6 }}>
              Limpiar filtros
            </button>
          )}

          <div className="ml-auto inline-flex items-center gap-2 flex-wrap">
            {view !== "list" && (
              <>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)}
                  style={{ padding: "8px 10px", fontSize: 13, minWidth: 140 }} />
                <button className="btn btn-ghost" type="button" onClick={() => shiftDate(-1)} title="Anterior">←</button>
                <button className="btn btn-ghost" type="button" onClick={() => setDate(today)}>Hoy</button>
                <button className="btn btn-ghost" type="button" onClick={() => shiftDate(1)} title="Siguiente">→</button>
              </>
            )}
            <button className="btn btn-ghost" type="button" onClick={loadData} title="Refrescar">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
        </div>

        {hasActiveFilters && view === "list" && (
          <p className="text-xs relative" style={{ color: "var(--text-muted)" }}>
            Mostrando <strong style={{ color: "#a87800" }}>{visible.length}</strong> de {premiaciones.length} premiaciones
          </p>
        )}
      </section>

      {error && (
        <section className="surface rounded-2xl p-4" style={{ borderLeft: "4px solid #b3231b", backgroundColor: "#fde2e2" }}>
          <p className="text-sm" style={{ color: "#7a1313" }}>{error}</p>
        </section>
      )}
      {message && !error && (
        <section className="surface rounded-2xl p-4" style={{ borderLeft: "4px solid #2e7d32", backgroundColor: "#e7f5ec" }}>
          <p className="text-sm" style={{ color: "#1e5125" }}>{message}</p>
        </section>
      )}

      {/* Contenido principal: loading | empty | day | week */}
      {loading ? (
        <section className="surface rounded-2xl p-5">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando…</p>
        </section>
      ) : visible.length === 0 ? (
        /* Empty state hero — visualmente impactante */
        <section className="surface-premium accent-strip-gold mesh-bg p-16 text-center relative overflow-hidden anim-fade-up-soft"
          style={{
            minHeight: "480px",
            background: "linear-gradient(135deg, #fefdf8 0%, #fdf6e3 50%, #fefdf8 100%)",
          }}>

          {/* Halo dorado masivo */}
          <div className="ambient-orb anim-orb-slow"
            style={{
              width: "500px", height: "500px",
              top: "-150px", left: "50%", transform: "translateX(-50%)",
              background: "radial-gradient(circle, rgba(212,160,23,0.25) 0%, transparent 65%)",
              opacity: 1,
            }} />

          {/* Particles flotantes */}
          <div className="particle particle-gold" style={{ top: "20%", left: "15%", animationDelay: "0s" }} />
          <div className="particle particle-gold" style={{ top: "30%", right: "20%", animationDelay: "1s" }} />
          <div className="particle particle-gold" style={{ top: "60%", left: "12%", animationDelay: "2s" }} />
          <div className="particle particle-gold" style={{ top: "70%", right: "15%", animationDelay: "3s" }} />
          <div className="particle" style={{ top: "45%", left: "8%", animationDelay: "1.5s" }} />
          <div className="particle" style={{ top: "25%", right: "10%", animationDelay: "2.5s" }} />

          <div className="relative z-10">
            {/* Hero icon — trofeo grande con anillos orbitales */}
            <div className="hero-icon-wrap mb-6">
              {/* Anillo orbital exterior */}
              <div className="orbit-ring orbit-ring-gold"
                style={{ inset: "0", animationDuration: "30s" }} />
              {/* Anillo orbital interior */}
              <div className="orbit-ring orbit-ring-gold"
                style={{ inset: "15px", animationDuration: "20s", animationDirection: "reverse", opacity: 0.5 }} />
              {/* Pulse ring */}
              <div className="pulse-ring"
                style={{
                  inset: "10px",
                  borderColor: "rgba(212,160,23,0.5)",
                }} />
              {/* Core con trofeo */}
              <div className="hero-icon-core"
                style={{
                  background: "linear-gradient(135deg, #d4a017 0%, #f5c842 50%, #e3a808 100%)",
                }}>
                <TrophyIcon size={56} color="#fff" />
              </div>
            </div>

            <h3 className="text-3xl font-extrabold mb-3 tracking-tight">
              <span className="text-gradient-trophy">
                Sin premiaciones {view === "day" ? "para hoy" : view === "week" ? "esta semana" : hasActiveFilters ? "con esos filtros" : "registradas"}
              </span>
            </h3>
            <p className="text-base mb-8 max-w-lg mx-auto leading-relaxed"
              style={{ color: "var(--text-muted)" }}>
              Cuando programes una ceremonia, va a aparecer acá con todos sus entregadores,
              el lugar y la hora.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              <button className="btn btn-primary text-base px-6 py-3"
                type="button" onClick={() => openCreateModal()}>
                <PlusIcon size={18} className="inline-block mr-1.5" />
                Nueva premiación
              </button>
              <Link href="/deportes"
                className="btn btn-ghost text-base px-6 py-3">
                Ir a Deportes →
              </Link>
            </div>
          </div>
        </section>
      ) : view === "list" ? (
        /* Vista LISTA: todas las premiaciones, agrupadas por fecha */
        <section className="surface-premium accent-strip-gold p-5 space-y-5 anim-fade-up-soft relative overflow-hidden">
          <div className="ambient-orb" style={{ width: 240, height: 240, top: -80, right: -60, background: "radial-gradient(circle, rgba(212,160,23,0.10) 0%, transparent 65%)" }} />
          <div className="flex items-center justify-between flex-wrap gap-3 pb-1 relative">
            <div className="flex items-center gap-3">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center icon-bounce"
                style={{
                  background: "linear-gradient(135deg, #fff4d6 0%, #f5c84260 100%)",
                  color: "#a87800",
                  border: "1px solid #c78c0033",
                  boxShadow: "0 2px 10px rgba(199,140,0,0.18)",
                }}
              >
                <TrophyIcon size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#a87800" }}>Listado completo</p>
                <h2 className="text-lg font-extrabold tracking-tight" style={{ color: "#0f172a" }}>
                  {visible.length} {visible.length === 1 ? "premiación" : "premiaciones"}
                  {listGrouped.length > 1 && (
                    <span className="text-sm font-semibold ml-2" style={{ color: "var(--text-muted)" }}>
                      · {listGrouped.length} días
                    </span>
                  )}
                </h2>
              </div>
            </div>
          </div>

          {listGrouped.length === 0 ? (
            <div className="text-center py-12 relative">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No hay premiaciones que coincidan con los filtros seleccionados.
              </p>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="btn btn-ghost mt-3 text-sm">
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5 relative">
              {listGrouped.map(({ date: groupDate, items }) => {
                const isToday = groupDate === today;
                const isPast = new Date(groupDate) < new Date(today);
                return (
                  <div key={groupDate}>
                    {/* Encabezado del día */}
                    <div className="flex items-center gap-3 mb-2.5 sticky top-0 z-10 py-1.5"
                      style={{ background: "linear-gradient(180deg, #ffffff 0%, #ffffffe0 100%)", backdropFilter: "blur(6px)" }}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center rounded-lg font-bold text-[11px] uppercase tracking-wider"
                          style={{
                            width: 50, padding: "4px 0",
                            background: isToday
                              ? "linear-gradient(135deg, #d4a017 0%, #f5c842 100%)"
                              : isPast ? "#f1f5f9" : "#fff4d6",
                            color: isToday ? "#fff" : isPast ? "#94a3b8" : "#7a4a00",
                            border: `1px solid ${isToday ? "#a87800" : isPast ? "#e2e8f0" : "#c78c0033"}`,
                          }}>
                          {fmtDayShort(groupDate)}
                        </div>
                        <h3 className="text-sm font-bold capitalize" style={{ color: isToday ? "#a87800" : "#0f172a" }}>
                          {fmtDateLong(groupDate)}
                          {isToday && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#a87800" }}>· Hoy</span>}
                        </h3>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                        {items.length} {items.length === 1 ? "ceremonia" : "ceremonias"}
                      </span>
                      <div className="flex-1 border-t border-dashed" style={{ borderColor: "#e2e8f0" }} />
                    </div>
                    <div className="space-y-2.5">
                      {items.map((p) => (
                        <PremiacionCard
                          key={p.id}
                          p={p}
                          athleteName={athleteName}
                          onToggle={() => toggleStatus(p)}
                          onConfirm={(awId) => confirmAwarder(p.id, awId, "confirm")}
                          onDecline={(awId) => confirmAwarder(p.id, awId, "decline")}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : view === "day" ? (
        /* Vista DÍA: lista simple con tarjetas grandes */
        <section className="surface-premium accent-strip-gold p-5 space-y-3 anim-fade-up-soft relative overflow-hidden">
          <div className="ambient-orb" style={{ width: 220, height: 220, top: -70, right: -50, background: "radial-gradient(circle, rgba(212,160,23,0.10) 0%, transparent 65%)" }} />
          <div className="flex items-center justify-between flex-wrap gap-3 pb-1 relative">
            <div className="flex items-center gap-3">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center icon-bounce"
                style={{
                  background: "linear-gradient(135deg, #fff4d6 0%, #f5c84260 100%)",
                  color: "#a87800",
                  border: "1px solid #c78c0033",
                  boxShadow: "0 2px 10px rgba(199,140,0,0.18)",
                }}
              >
                <CalendarIcon size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#a87800" }}>Agenda del día</p>
                <h2 className="text-lg font-extrabold capitalize tracking-tight" style={{ color: "#0f172a" }}>
                  {fmtDateLong(date)}
                </h2>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1"
              style={{ background: "#fff4d6", color: "#a87800", border: "1px solid #c78c0033" }}>
              <TrophyIcon size={14} />
              {visible.length} {visible.length === 1 ? "ceremonia" : "ceremonias"}
            </span>
          </div>
          <div className="space-y-3 relative">
            {visible.map((p) => (
              <PremiacionCard
                key={p.id}
                p={p}
                athleteName={athleteName}
                onToggle={() => toggleStatus(p)}
                onConfirm={(awId) => confirmAwarder(p.id, awId, "confirm")}
                onDecline={(awId) => confirmAwarder(p.id, awId, "decline")}
              />
            ))}
          </div>
        </section>
      ) : (
        /* Vista SEMANA: grilla 7 columnas */
        <section className="surface-premium accent-strip-gold p-4 anim-fade-up-soft relative overflow-hidden">
          <div className="ambient-orb" style={{ width: 240, height: 240, top: -80, right: -60, background: "radial-gradient(circle, rgba(212,160,23,0.10) 0%, transparent 65%)" }} />
          <div className="grid grid-cols-7 gap-2 relative">
            {getWeekDays(date).map((dayKey) => {
              const items = grouped.get(dayKey) || [];
              const isToday = dayKey === today;
              return (
                <div key={dayKey} className="rounded-xl p-2.5 min-h-[200px]"
                  style={{
                    background: isToday
                      ? "linear-gradient(180deg, #fff8e1 0%, #fefdf8 100%)"
                      : "#fafbfc",
                    border: isToday ? "1.5px solid #d4a017" : "1px solid #e2e8f0",
                    boxShadow: isToday ? "0 4px 14px rgba(212,160,23,0.18)" : "none",
                    transition: "box-shadow 200ms",
                  }}>
                  <div className="flex items-center justify-between mb-2 gap-1">
                    <p className="text-xs font-bold capitalize"
                      style={{ color: isToday ? "#7a5800" : "var(--text-muted)" }}>
                      {fmtDayShort(dayKey)}
                    </p>
                    {items.length > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-full"
                        style={{
                          background: isToday
                            ? "linear-gradient(135deg, #d4a017 0%, #f5c842 100%)"
                            : "#e2e8f0",
                          color: isToday ? "#fff" : "#475569",
                          boxShadow: isToday ? "0 2px 6px rgba(212,160,23,0.4)" : "none",
                        }}>
                        {items.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {items.map((p) => {
                      const isDone = p.status === "REALIZADA";
                      const noAwarders = !p.awarders || p.awarders.length === 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleStatus(p)}
                          className="w-full text-left border rounded-md p-2 text-xs hover:shadow-md transition"
                          style={{
                            borderLeft: `4px solid ${isDone ? "#2e7d32" : noAwarders ? "#b3231b" : "#c78c00"}`,
                            backgroundColor: isDone ? "#f7fcf8" : noAwarders ? "#fef6f6" : "#fffbf2",
                          }}
                          title={`${p.title} — ${isDone ? "Realizada" : "Programada"}. Click para alternar estado.`}
                        >
                          <p className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {fmtTime(p.scheduledAt)}
                          </p>
                          <p className="font-medium truncate">{p.title}</p>
                          {p.discipline && (
                            <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                              {p.discipline}
                            </p>
                          )}
                          {noAwarders && (
                            <p className="text-[10px] mt-0.5" style={{ color: "#b3231b" }}>
                              ⚠ Sin entregadores
                            </p>
                          )}
                        </button>
                      );
                    })}
                    {items.length === 0 && (
                      <p className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                        —
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal: Nueva premiación */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-semibold">Nueva premiación</h2>
              <button className="btn btn-ghost text-sm" type="button" onClick={closeModal}>
                Cerrar ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                La premiación quedará asociada a la prueba/disciplina que selecciones, y aparecerá
                también al editarla desde el módulo Deportes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Selector en cascada: Deporte → Categoría → Género → Prueba */}
                <div className="md:col-span-2 border rounded-lg p-3" style={{ backgroundColor: "#fafbfc" }}>
                  <p className="section-label mb-2">Seleccionar prueba *</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    <label className="text-sm">
                      <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Género</span>
                      <select className="input" value={filterGender}
                        onChange={(e) => {
                          setFilterGender(e.target.value);
                          setFilterCategory("");
                          setFilterSportId("");
                          setForm((f) => ({ ...f, disciplineId: "" }));
                        }}>
                        <option value="">— Todos —</option>
                        {availableGenders.map((g) => (
                          <option key={g} value={g}>{labelOf(GENDER_LABELS, g)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Categoría</span>
                      <select className="input" value={filterCategory}
                        onChange={(e) => {
                          setFilterCategory(e.target.value);
                          setFilterSportId("");
                          setForm((f) => ({ ...f, disciplineId: "" }));
                        }}>
                        <option value="">— Todas —</option>
                        {availableCategories.map((c) => (
                          <option key={c} value={c}>{labelOf(CATEGORY_LABELS, c)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Deporte</span>
                      <select className="input" value={filterSportId}
                        onChange={(e) => {
                          setFilterSportId(e.target.value);
                          setForm((f) => ({ ...f, disciplineId: "" }));
                        }}>
                        <option value="">— Todos —</option>
                        {availableSports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="text-sm block">
                    <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                      Prueba ({filteredDisciplines.length} disponible{filteredDisciplines.length === 1 ? "" : "s"})
                    </span>
                    <select className="input" value={form.disciplineId}
                      onChange={(e) => selectDiscipline(e.target.value)}>
                      <option value="">— Seleccionar prueba —</option>
                      {filteredDisciplines.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                          {d.category ? ` · ${labelOf(CATEGORY_LABELS, d.category)}` : ""}
                          {d.gender ? ` · ${labelOf(GENDER_LABELS, d.gender)}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {filteredDisciplines.length === 0 && (filterSportId || filterCategory || filterGender) && (
                    <p className="text-xs mt-2" style={{ color: "#b3231b" }}>
                      No hay pruebas que coincidan con estos filtros.
                    </p>
                  )}
                </div>

                <label className="text-sm md:col-span-2">
                  <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                    Título de la ceremonia *
                  </span>
                  <input type="text" className="input"
                    placeholder="Ej: Premiación 100m Planos Femenino"
                    value={form.title}
                    onChange={(e) => setFormField("title", e.target.value)} />
                </label>

                <label className="text-sm">
                  <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                    Fecha y hora *
                  </span>
                  <input type="datetime-local" className="input"
                    value={form.scheduledAt}
                    onChange={(e) => setFormField("scheduledAt", e.target.value)} />
                </label>

                <label className="text-sm">
                  <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                    Venue (opcional)
                  </span>
                  <select className="input" value={form.venueId}
                    onChange={(e) => {
                      const v = venues.find((x) => x.id === e.target.value);
                      setForm((f) => ({
                        ...f,
                        venueId: e.target.value,
                        venueName: v?.name || "",
                      }));
                    }}>
                    <option value="">— Sin venue —</option>
                    {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </label>

                <label className="text-sm md:col-span-2">
                  <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                    Detalle de ubicación (opcional)
                  </span>
                  <input type="text" className="input"
                    placeholder="Ej: Tarima central — frente a grada norte"
                    value={form.locationDetail}
                    onChange={(e) => setFormField("locationDetail", e.target.value)} />
                </label>

                <label className="text-sm md:col-span-2">
                  <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                    Notas (opcional)
                  </span>
                  <textarea className="input" rows={2}
                    value={form.notes}
                    onChange={(e) => setFormField("notes", e.target.value)} />
                </label>
              </div>

              {/* Entregadores */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="section-label">Entregadores (VIPs)</p>
                  <button className="btn btn-ghost text-xs" type="button" onClick={addAwarder}>
                    + Agregar entregador
                  </button>
                </div>
                {form.awarders.length === 0 ? (
                  <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                    Sin entregadores asignados. Podés agregarlos ahora o más tarde.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.awarders.map((aw, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <select className="input flex-1 min-w-[200px]"
                          value={aw.athleteId}
                          onChange={(e) => updateAwarder(idx, "athleteId", e.target.value)}>
                          <option value="">— Seleccionar VIP —</option>
                          {athletes.map((a) => (
                            <option key={a.id} value={a.id}>{a.fullName}</option>
                          ))}
                        </select>
                        <select className="input w-36"
                          value={aw.role}
                          onChange={(e) => updateAwarder(idx, "role", e.target.value)}>
                          {AWARDER_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <button className="btn btn-ghost text-xs" type="button"
                          onClick={() => removeAwarder(idx)}>
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t flex justify-end gap-2 sticky bottom-0 bg-white rounded-b-2xl">
              <button className="btn btn-ghost" type="button" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={submitCreate} disabled={saving}>
                {saving ? "Creando…" : "Crear premiación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PremiacionCard({
  p,
  athleteName,
  onToggle,
  onConfirm,
  onDecline,
}: {
  p: Premiacion;
  athleteName: (id: string) => string;
  onToggle: () => void;
  onConfirm: (awarderId: string) => void;
  onDecline: (awarderId: string) => void;
}) {
  const isDone = p.status === "REALIZADA";
  const awarders = p.awarders || [];
  const noAwarders = awarders.length === 0;
  const accentColor = isDone ? "#2e7d32" : "#c78c00";
  const accentBg    = isDone ? "linear-gradient(135deg, #f7fcf8 0%, #ffffff 70%)" : "linear-gradient(135deg, #fffbf2 0%, #ffffff 70%)";
  return (
    <article
      className="rounded-2xl p-4 transition-shadow"
      style={{
        borderLeft: `5px solid ${accentColor}`,
        border: `1px solid ${isDone ? "#cfe9d6" : "#f0deb0"}`,
        borderLeftWidth: 5,
        background: accentBg,
        boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 18px rgba(15,23,42,0.1)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(15,23,42,0.05)"; }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: isDone
                ? "linear-gradient(135deg, #e7f5ec 0%, #cfe9d6 100%)"
                : "linear-gradient(135deg, #fff4d6 0%, #f5c84280 100%)",
              color: isDone ? "#2e7d32" : "#a87800",
              border: `1px solid ${isDone ? "#2e7d3233" : "#c78c0033"}`,
              boxShadow: `0 2px 8px ${isDone ? "rgba(46,125,50,0.18)" : "rgba(199,140,0,0.22)"}`,
            }}>
            <TrophyIcon size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight" style={{ color: "#0f172a" }}>{p.title}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
              <span className="inline-flex items-center gap-1 font-mono font-semibold" style={{ color: "#334155" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                {fmtTime(p.scheduledAt)}
              </span>
              {p.discipline && (
                <span className="inline-flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9a6 6 0 0 0 12 0H6z" /><line x1="12" y1="15" x2="12" y2="21" /><line x1="8" y1="21" x2="16" y2="21" />
                  </svg>
                  {p.discipline}
                </span>
              )}
              {p.venueName && (
                <span className="inline-flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  {p.venueName}{p.locationDetail ? ` · ${p.locationDetail}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"
            style={{
              backgroundColor: isDone ? "#e7f5ec" : "#fff4d6",
              color: isDone ? "#1e5125" : "#7a4a00",
              border: `1px solid ${isDone ? "#2e7d3233" : "#c78c0033"}`,
            }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: isDone ? "#2e7d32" : "#c78c00", animation: isDone ? "none" : "pulse 1.8s infinite" }} />
            {isDone ? "Realizada" : "Programada"}
          </span>
          <button className={`btn ${isDone ? "btn-ghost" : "btn-primary"}`}
            type="button" onClick={onToggle}>
            {isDone ? "Marcar como pendiente" : "Marcar como realizada"}
          </button>
        </div>
      </div>

      {noAwarders ? (
        <p className="text-xs mt-2" style={{ color: "#b3231b" }}>
          ⚠ Sin entregadores asignados
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
          {awarders.map((aw) => {
            const meta =
              ROLE_LABELS[String(aw.role || "AWARDER").toUpperCase()] ||
              ROLE_LABELS.AWARDER;
            const confirmed = !!aw.confirmedAt;
            const declined = !!aw.declinedAt;
            return (
              <div key={aw.id || aw.athleteId}
                className="flex items-center justify-between border rounded-lg px-3 py-2"
                style={{ backgroundColor: "#fff" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ backgroundColor: meta.color, color: "#fff" }}>
                    {meta.label}
                  </span>
                  <span className="text-sm truncate">{athleteName(aw.athleteId)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {confirmed ? (
                    <span className="text-xs" style={{ color: "#2e7d32" }}>✓ Confirmado</span>
                  ) : declined ? (
                    <span className="text-xs" style={{ color: "#b3231b" }}>✗ Declinó</span>
                  ) : (
                    <>
                      <button className="btn btn-ghost text-xs py-1 px-2" type="button"
                        disabled={!aw.id} onClick={() => aw.id && onConfirm(aw.id)}>
                        Confirmar
                      </button>
                      <button className="btn btn-ghost text-xs py-1 px-2" type="button"
                        disabled={!aw.id} onClick={() => aw.id && onDecline(aw.id)}>
                        Declinar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {p.notes && (
        <p className="text-xs mt-3 italic" style={{ color: "var(--text-muted)" }}>
          {p.notes}
        </p>
      )}
    </article>
  );
}
