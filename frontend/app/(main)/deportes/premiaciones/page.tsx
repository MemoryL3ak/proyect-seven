"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import StyledSelect from "@/components/StyledSelect";
import { TrophyIcon, CheckIcon, AlertIcon, CalendarIcon, SearchIcon } from "@/components/ui/Icons";

type Awarder = {
  id?: string;
  athleteId: string;
  role?: string | null;
  confirmedAt?: string | null;
  declinedAt?: string | null;
};
type Premiacion = {
  id: string;
  eventId?: string | null;
  title: string;
  discipline?: string | null;
  disciplineId?: string | null;
  scheduledAt: string;
  venueId?: string | null;
  venueName?: string | null;
  locationDetail?: string | null;
  status: string;
  notes?: string | null;
  awarders?: Awarder[] | null;
};
type Athlete = { id: string; fullName?: string | null; userType?: string | null };
type EventItem = { id: string; name: string };
type Venue = { id: string; name: string; address?: string | null };

type AwarderState = "CONFIRMED" | "DECLINED" | "PENDING";
const awarderState = (a: Awarder): AwarderState =>
  a.confirmedAt ? "CONFIRMED" : a.declinedAt ? "DECLINED" : "PENDING";

const AWARDER_META: Record<AwarderState, { label: string; color: string; bg: string; icon: string }> = {
  CONFIRMED: { label: "Confirmó", color: "#059669", bg: "#e7f5ec", icon: "✓" },
  DECLINED: { label: "Rechazó", color: "#dc2626", bg: "#fde2e2", icon: "✕" },
  PENDING: { label: "Pendiente", color: "#b45309", bg: "#fef3c7", icon: "⏳" },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PROGRAMADA: { label: "Programada", color: "#1f4e8c", bg: "#e3edfa" },
  REALIZADA: { label: "Realizada", color: "#059669", bg: "#e7f5ec" },
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

/** ISO → valor para <input type="datetime-local"> en hora local. */
function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Distancia legible hasta la ceremonia ("Hoy", "Mañana", "En 3 días"). */
function relativeDay(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(d) - startOf(new Date())) / 86400000);
  if (diff < 0) return null;
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return `En ${diff} días`;
}

const EMPTY_FORM = {
  title: "",
  discipline: "",
  scheduledAt: "",
  eventId: "",
  venueId: "",
  locationDetail: "",
  notes: "",
  status: "PROGRAMADA",
};

export default function PremiacionesPage() {
  const [premiaciones, setPremiaciones] = useState<Premiacion[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "timeline">("cards");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Modal crear / editar premiación completa
  const [formOpen, setFormOpen] = useState(false);
  const [formEditingId, setFormEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formAwarders, setFormAwarders] = useState<Awarder[]>([]);
  const [addAthleteId, setAddAthleteId] = useState("");
  const [savingForm, setSavingForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [prem, ath, ev, ven] = await Promise.all([
        apiFetch<Premiacion[]>("/premiaciones"),
        apiFetch<Athlete[]>("/athletes").catch(() => []),
        apiFetch<EventItem[]>("/events").catch(() => []),
        apiFetch<Venue[]>("/venues").catch(() => []),
      ]);
      setPremiaciones(Array.isArray(prem) ? prem : []);
      setAthletes(Array.isArray(ath) ? ath : []);
      setEvents(Array.isArray(ev) ? ev : []);
      setVenues(Array.isArray(ven) ? ven : []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudieron cargar las premiaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const athleteName = useMemo(() => {
    const map = new Map(athletes.map((a) => [a.id, a.fullName || a.id.slice(0, 8)]));
    return (id: string) => map.get(id) || id.slice(0, 8);
  }, [athletes]);

  const disciplineOptions = useMemo(
    () => Array.from(new Set(premiaciones.map((p) => (p.discipline || "").trim()).filter(Boolean))).sort(),
    [premiaciones],
  );

  // La próxima ceremonia siempre primero: próximas ascendente, pasadas después
  // (la más reciente primero).
  const { upcoming, past } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = premiaciones
      .filter((p) => (eventFilter ? p.eventId === eventFilter : true))
      .filter((p) => (statusFilter ? p.status === statusFilter : true))
      .filter((p) => (disciplineFilter ? (p.discipline || "") === disciplineFilter : true))
      .filter((p) => {
        if (!q) return true;
        const text = `${p.title} ${p.discipline || ""} ${p.venueName || ""} ${p.locationDetail || ""}`.toLowerCase();
        return text.includes(q);
      });
    const now = Date.now();
    const time = (p: Premiacion) => new Date(p.scheduledAt).getTime() || 0;
    const upcoming = filtered
      .filter((p) => time(p) >= now && p.status !== "REALIZADA")
      .sort((a, b) => time(a) - time(b));
    const past = filtered
      .filter((p) => time(p) < now || p.status === "REALIZADA")
      .sort((a, b) => time(b) - time(a));
    return { upcoming, past };
  }, [premiaciones, eventFilter, statusFilter, disciplineFilter, search]);

  const kpis = useMemo(() => {
    let programadas = 0, realizadas = 0, pendientes = 0;
    premiaciones.forEach((p) => {
      if (p.status === "REALIZADA") realizadas++; else programadas++;
      (p.awarders || []).forEach((a) => {
        if (awarderState(a) === "PENDING") pendientes++;
      });
    });
    return { total: premiaciones.length, programadas, realizadas, pendientes };
  }, [premiaciones]);

  // Candidatos a entregadores: VIP primero; si no hay VIP marcados, todos.
  const awarderCandidates = useMemo(() => {
    const vips = athletes.filter((a) => String(a.userType ?? "").toUpperCase() === "VIP");
    const base = vips.length > 0 ? vips : athletes;
    return [...base].sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
  }, [athletes]);

  const openCreate = () => {
    setFormEditingId(null);
    setForm({ ...EMPTY_FORM, eventId: eventFilter || (events[0]?.id ?? "") });
    setFormAwarders([]);
    setAddAthleteId("");
    setMessage(null);
    setFormOpen(true);
  };

  const openEdit = (p: Premiacion) => {
    setFormEditingId(p.id);
    setForm({
      title: p.title || "",
      discipline: p.discipline || "",
      scheduledAt: toLocalInput(p.scheduledAt),
      eventId: p.eventId || "",
      venueId: p.venueId || "",
      locationDetail: p.locationDetail || "",
      notes: p.notes || "",
      status: p.status || "PROGRAMADA",
    });
    setFormAwarders([...(p.awarders || [])]);
    setAddAthleteId("");
    setMessage(null);
    setFormOpen(true);
  };

  const addAwarder = (athleteId: string) => {
    if (!athleteId) return;
    setFormAwarders((prev) =>
      prev.some((a) => a.athleteId === athleteId) ? prev : [...prev, { athleteId }],
    );
    setAddAthleteId("");
  };

  const removeAwarder = (athleteId: string) => {
    setFormAwarders((prev) => prev.filter((a) => a.athleteId !== athleteId));
  };

  const saveForm = async () => {
    if (!form.title.trim()) { setMessage("El título es obligatorio."); return; }
    if (!form.scheduledAt) { setMessage("La fecha y hora son obligatorias."); return; }
    setSavingForm(true);
    setMessage(null);
    try {
      const venue = venues.find((v) => v.id === form.venueId);
      const payload = {
        title: form.title.trim(),
        discipline: form.discipline.trim() || undefined,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        eventId: form.eventId || undefined,
        venueId: form.venueId || undefined,
        venueName: venue?.name || undefined,
        locationDetail: form.locationDetail.trim() || undefined,
        notes: form.notes.trim() || undefined,
        status: form.status,
        awarders: formAwarders.map((a) => ({ athleteId: a.athleteId, role: a.role || undefined })),
      };
      if (formEditingId) {
        await apiFetch(`/premiaciones/${formEditingId}`, {
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
      setFormOpen(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo guardar la premiación.");
    } finally {
      setSavingForm(false);
    }
  };

  const deletePremiacion = async () => {
    if (!formEditingId) return;
    if (!window.confirm("¿Eliminar esta premiación? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    setMessage(null);
    try {
      await apiFetch(`/premiaciones/${formEditingId}`, { method: "DELETE" });
      setFormOpen(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo eliminar la premiación.");
    } finally {
      setDeleting(false);
    }
  };

  const changeStatus = async (p: Premiacion, next: string) => {
    if (next === p.status) return;
    setSavingId(p.id);
    setMessage(null);
    try {
      await apiFetch(`/premiaciones/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      setPremiaciones((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: next } : x)));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
    } finally {
      setSavingId(null);
    }
  };

  const renderCard = (p: Premiacion, isNext: boolean) => {
    const st = STATUS_META[p.status] || STATUS_META.PROGRAMADA;
    const awarders = p.awarders || [];
    const confirmed = awarders.filter((a) => awarderState(a) === "CONFIRMED").length;
    const rel = p.status !== "REALIZADA" ? relativeDay(p.scheduledAt) : null;
    return (
      <article key={p.id} className="surface rounded-2xl p-4 space-y-3"
        style={{
          borderTop: `4px solid ${p.status === "REALIZADA" ? "#059669" : isNext ? "#21D0B3" : "#fbbf24"}`,
          ...(isNext ? { boxShadow: "0 0 0 2px rgba(33,208,179,0.35), 0 10px 24px rgba(15,23,42,0.10)" } : {}),
        }}>
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-2">
          <div style={{ minWidth: 0 }}>
            {isNext && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1"
                style={{ background: "rgba(33,208,179,0.14)", color: "#0f9d84", border: "1px solid rgba(33,208,179,0.45)", letterSpacing: "0.08em" }}>
                ★ PRÓXIMA CEREMONIA
              </span>
            )}
            <p className="font-bold text-[15px] leading-tight" style={{ color: "#0f172a" }}>{p.title}</p>
            {p.discipline && (
              <p className="text-xs mt-0.5" style={{ color: "#14b8a6", fontWeight: 600 }}>{p.discipline}</p>
            )}
          </div>
          <select value={p.status} disabled={savingId === p.id}
            onChange={(e) => changeStatus(p, e.target.value)}
            title="Cambiar estado"
            className="text-[10px] font-bold px-2 py-1 rounded-full"
            style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}55`, cursor: "pointer", whiteSpace: "nowrap", appearance: "auto" }}>
            <option value="PROGRAMADA">Programada</option>
            <option value="REALIZADA">Realizada</option>
          </select>
        </div>

        {/* Datos */}
        <div className="text-xs space-y-0.5" style={{ color: "#64748b" }}>
          <p style={{ color: "#0f172a", fontWeight: 600 }}>
            🗓 {fmtDateTime(p.scheduledAt)}
            {rel && (
              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: rel === "Hoy" ? "#fef3c7" : "#eef1f6", color: rel === "Hoy" ? "#b45309" : "#64748b" }}>
                {rel}
              </span>
            )}
          </p>
          {(p.venueName || p.locationDetail) && (
            <p>📍 {[p.venueName, p.locationDetail].filter(Boolean).join(" · ")}</p>
          )}
          {p.notes && <p style={{ color: "#94a3b8" }}>📝 {p.notes}</p>}
        </div>

        {/* Entregadores + confirmación */}
        <div className="rounded-xl p-3" style={{ background: "#f8fafc", border: "1px solid #eef1f6" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
              Entregadores (VIP)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: confirmed === awarders.length && awarders.length > 0 ? "#e7f5ec" : "#eef1f6", color: confirmed === awarders.length && awarders.length > 0 ? "#059669" : "#64748b" }}>
              {confirmed}/{awarders.length} confirmaron
            </span>
          </div>
          {awarders.length === 0 ? (
            <p className="text-[11px]" style={{ color: "#94a3b8" }}>Sin entregadores asignados.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {awarders.map((a, i) => {
                const state = awarderState(a);
                const meta = AWARDER_META[state];
                return (
                  <div key={a.id || i} className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] truncate" style={{ color: "#0f172a", fontWeight: 500 }}>
                      {athleteName(a.athleteId)}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 flex-shrink-0"
                      style={{ background: meta.bg, color: meta.color }}
                      title={state === "CONFIRMED" && a.confirmedAt ? fmtDateTime(a.confirmedAt) : undefined}>
                      <span>{meta.icon}</span>{meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => openEdit(p)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "#fff7ed", color: "#d97706", border: "1px solid #fed7aa", cursor: "pointer" }}>
            ✎ Editar premiación
          </button>
          {p.disciplineId && (
            <Link href="/deportes" className="text-xs font-semibold" style={{ color: "#14b8a6" }}>
              Ver prueba →
            </Link>
          )}
        </div>
      </article>
    );
  };

  const totalVisible = upcoming.length + past.length;

  return (
    <div className="space-y-5 min-w-0 overflow-x-hidden">
      <PageHeader
        title="Premiaciones"
        description="Ceremonias de premiación por prueba, con sus entregadores VIP y el estado de confirmación de asistencia."
        icon={<TrophyIcon size={26} />}
        iconBg="linear-gradient(135deg, #fbbf24 0%, #d97706 100%)"
        accentStrip="gold"
        action={
          <button type="button" onClick={openCreate} className="btn btn-primary text-xs">
            + Nueva premiación
          </button>
        }
      />

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
        <KpiCard label="Ceremonias" value={kpis.total} icon={<TrophyIcon size={18} />} accent="amber" />
        <KpiCard label="Programadas" value={kpis.programadas} icon={<CalendarIcon size={18} />} accent="blue" />
        <KpiCard label="Realizadas" value={kpis.realizadas} icon={<CheckIcon size={18} />} accent="green" />
        <KpiCard
          label="VIP por confirmar"
          value={kpis.pendientes}
          detail={kpis.pendientes > 0 ? "entregadores pendientes" : "todos respondieron"}
          icon={<AlertIcon size={18} />}
          accent={kpis.pendientes > 0 ? "red" : "neutral"}
        />
      </section>

      {/* Filtros */}
      <section className="surface rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }}>
            <SearchIcon size={15} />
          </span>
          <input className="input" style={{ paddingLeft: 36 }}
            placeholder="Buscar por prueba, disciplina o sede…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {events.length > 0 && (
          <StyledSelect wrapperStyle={{ maxWidth: 220 }} value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
            <option value="">Todos los eventos</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </StyledSelect>
        )}
        {disciplineOptions.length > 0 && (
          <StyledSelect wrapperStyle={{ maxWidth: 200 }} value={disciplineFilter} onChange={(e) => setDisciplineFilter(e.target.value)}>
            <option value="">Todas las disciplinas</option>
            {disciplineOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </StyledSelect>
        )}
        <StyledSelect wrapperStyle={{ maxWidth: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="PROGRAMADA">Programadas</option>
          <option value="REALIZADA">Realizadas</option>
        </StyledSelect>
        {/* Toggle de vista */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
          {([["cards", "Tarjetas"], ["timeline", "Timeline"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setViewMode(v)}
              className="text-xs font-bold px-3 py-2"
              style={{
                background: viewMode === v ? "#0f172a" : "#fff",
                color: viewMode === v ? "#34F3C6" : "#64748b",
                border: "none", cursor: "pointer",
              }}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {message && !formOpen && <p className="text-sm" style={{ color: "#b91c1c" }}>{message}</p>}

      {/* Lista */}
      {loading ? (
        <p className="text-sm" style={{ color: "#94a3b8" }}>Cargando premiaciones…</p>
      ) : totalVisible === 0 ? (
        <div className="p-12 text-center rounded-2xl" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)", border: "1px dashed #e2e8f0" }}>
          <TrophyIcon size={36} color="#cbd5e1" />
          <p className="text-sm font-semibold mt-3" style={{ color: "#475569" }}>No hay premiaciones para mostrar</p>
          <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
            Crea la primera con el botón <button type="button" onClick={openCreate} style={{ color: "#14b8a6", fontWeight: 600, cursor: "pointer" }}>+ Nueva premiación</button>.
          </p>
        </div>
      ) : viewMode === "timeline" ? (
        /* Timeline cronológico — mismo estilo que la bitácora de viajes */
        <section className="surface rounded-2xl p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#0f9d84" }}>
            Timeline de premiaciones
          </h2>
          <div style={{ position: "relative", paddingLeft: 20 }}>
            <div style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 2, background: "#e2e8f0", borderRadius: 1 }} />
            {(() => {
              const items = [...[...past].reverse(), ...upcoming];
              const nextId = upcoming[0]?.id ?? null;
              return items.map((p, i) => {
                const isNext = p.id === nextId;
                const isDone = p.status === "REALIZADA";
                const color = isDone ? "#059669" : isNext ? "#21D0B3" : "#f59e0b";
                const awarders = p.awarders || [];
                const confirmed = awarders.filter((a) => awarderState(a) === "CONFIRMED").length;
                return (
                  <div key={p.id} style={{ position: "relative", marginBottom: i < items.length - 1 ? 18 : 0 }}>
                    <div style={{ position: "absolute", left: -20, top: 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", border: `2px solid ${color}`, zIndex: 1, ...(isNext ? { boxShadow: `0 0 0 3px ${color}33` } : {}) }} />
                    <p className="text-[13px] font-bold" style={{ color, margin: 0 }}>
                      {fmtDateTime(p.scheduledAt)}
                      {isNext && (
                        <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full align-middle"
                          style={{ background: "rgba(33,208,179,0.14)", color: "#0f9d84", border: "1px solid rgba(33,208,179,0.45)" }}>
                          ★ PRÓXIMA
                        </span>
                      )}
                      <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full align-middle"
                        style={{ background: (STATUS_META[p.status] || STATUS_META.PROGRAMADA).bg, color: (STATUS_META[p.status] || STATUS_META.PROGRAMADA).color }}>
                        {(STATUS_META[p.status] || STATUS_META.PROGRAMADA).label}
                      </span>
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "#0f172a", margin: "2px 0 0" }}>
                      {p.title}
                      {p.discipline && <span className="ml-1.5 text-xs font-semibold" style={{ color: "#14b8a6" }}>· {p.discipline}</span>}
                    </p>
                    <p className="text-xs" style={{ color: "#64748b", margin: "2px 0 0" }}>
                      {[p.venueName, p.locationDetail].filter(Boolean).join(" · ") || "Sin sede definida"}
                      {awarders.length > 0 && ` · ${confirmed}/${awarders.length} VIP confirmaron`}
                    </p>
                    <button type="button" onClick={() => openEdit(p)}
                      className="text-[11px] font-semibold mt-1"
                      style={{ color: "#d97706", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
                      ✎ Editar
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </section>
      ) : (
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "#0f9d84" }}>
                Próximas ceremonias
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(33,208,179,0.12)", color: "#0f9d84" }}>{upcoming.length}</span>
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {upcoming.map((p, i) => renderCard(p, i === 0))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "#94a3b8" }}>
                Realizadas y pasadas
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#eef1f6", color: "#64748b" }}>{past.length}</span>
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {past.map((p) => renderCard(p, false))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal: crear / editar premiación */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }}
          onClick={() => !savingForm && !deleting && setFormOpen(false)}>
          <div className="surface rounded-2xl p-5 w-full max-w-lg space-y-4" style={{ maxHeight: "92vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-bold" style={{ color: "#0f172a" }}>
                {formEditingId ? "Editar premiación" : "Nueva premiación"}
              </h3>
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                {formEditingId ? "Modifica los datos de la ceremonia." : "Programa una ceremonia de premiación."}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Título *</label>
                <input className="input" placeholder="Ej: Final 100m planos varones"
                  value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Disciplina</label>
                  <input className="input" placeholder="Ej: Atletismo" list="premiacion-disciplinas"
                    value={form.discipline} onChange={(e) => setForm((f) => ({ ...f, discipline: e.target.value }))} />
                  <datalist id="premiacion-disciplinas">
                    {disciplineOptions.map((d) => <option key={d} value={d} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Fecha y hora *</label>
                  <input className="input" type="datetime-local"
                    value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {events.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Evento</label>
                    <StyledSelect value={form.eventId} onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}>
                      <option value="">Sin evento</option>
                      {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </StyledSelect>
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Sede</label>
                  <StyledSelect value={form.venueId} onChange={(e) => setForm((f) => ({ ...f, venueId: e.target.value }))}>
                    <option value="">Sin sede</option>
                    {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </StyledSelect>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Detalle de ubicación</label>
                  <input className="input" placeholder="Ej: Podio central, pista 1"
                    value={form.locationDetail} onChange={(e) => setForm((f) => ({ ...f, locationDetail: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Estado</label>
                  <StyledSelect value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="PROGRAMADA">Programada</option>
                    <option value="REALIZADA">Realizada</option>
                  </StyledSelect>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Notas</label>
                <textarea className="input" rows={2} placeholder="Notas internas de la ceremonia…"
                  value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>

              {/* Entregadores */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Entregadores VIP</label>
                <StyledSelect value={addAthleteId} onChange={(e) => addAwarder(e.target.value)}>
                  <option value="">Agregar un VIP…</option>
                  {awarderCandidates
                    .filter((a) => !formAwarders.some((e) => e.athleteId === a.id))
                    .map((a) => <option key={a.id} value={a.id}>{a.fullName || a.id.slice(0, 8)}</option>)}
                </StyledSelect>
                <div className="rounded-xl p-3 space-y-1.5 mt-2" style={{ background: "#f8fafc", border: "1px solid #eef1f6", maxHeight: 200, overflowY: "auto" }}>
                  {formAwarders.length === 0 ? (
                    <p className="text-[12px]" style={{ color: "#94a3b8" }}>Sin entregadores asignados.</p>
                  ) : formAwarders.map((a) => {
                    const state = awarderState(a);
                    const meta = AWARDER_META[state];
                    return (
                      <div key={a.athleteId} className="flex items-center justify-between gap-2">
                        <span className="text-[13px] truncate" style={{ color: "#0f172a", fontWeight: 500 }}>
                          {athleteName(a.athleteId)}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {a.id && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                              style={{ background: meta.bg, color: meta.color }}>
                              <span>{meta.icon}</span>{meta.label}
                            </span>
                          )}
                          <button type="button" onClick={() => removeAwarder(a.athleteId)}
                            className="text-[11px] font-bold" style={{ color: "#dc2626", cursor: "pointer" }} title="Quitar">
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] mt-1" style={{ color: "#94a3b8" }}>
                  Los entregadores nuevos reciben una notificación y empiezan como pendientes; las confirmaciones existentes se conservan.
                </p>
              </div>
            </div>

            {message && <p className="text-sm" style={{ color: "#b91c1c" }}>{message}</p>}

            <div className="flex items-center justify-between gap-2">
              {formEditingId ? (
                <button type="button" onClick={deletePremiacion} disabled={savingForm || deleting}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer" }}>
                  {deleting ? "Eliminando…" : "Eliminar"}
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost text-sm" onClick={() => setFormOpen(false)} disabled={savingForm || deleting}>Cancelar</button>
                <button type="button" className="btn btn-primary text-sm" onClick={saveForm} disabled={savingForm || deleting}>
                  {savingForm ? "Guardando…" : formEditingId ? "Guardar cambios" : "Crear premiación"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
