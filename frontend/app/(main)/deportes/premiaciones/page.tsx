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
  venueName?: string | null;
  locationDetail?: string | null;
  status: string;
  notes?: string | null;
  awarders?: Awarder[] | null;
};
type Athlete = { id: string; fullName?: string | null; userType?: string | null };
type EventItem = { id: string; name: string };

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

export default function PremiacionesPage() {
  const [premiaciones, setPremiaciones] = useState<Premiacion[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Edición de encargados VIP
  const [editing, setEditing] = useState<Premiacion | null>(null);
  const [editAwarders, setEditAwarders] = useState<Awarder[]>([]);
  const [addAthleteId, setAddAthleteId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [prem, ath, ev] = await Promise.all([
        apiFetch<Premiacion[]>("/premiaciones"),
        apiFetch<Athlete[]>("/athletes").catch(() => []),
        apiFetch<EventItem[]>("/events").catch(() => []),
      ]);
      setPremiaciones(Array.isArray(prem) ? prem : []);
      setAthletes(Array.isArray(ath) ? ath : []);
      setEvents(Array.isArray(ev) ? ev : []);
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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return premiaciones
      .filter((p) => (eventFilter ? p.eventId === eventFilter : true))
      .filter((p) => (statusFilter ? p.status === statusFilter : true))
      .filter((p) => (disciplineFilter ? (p.discipline || "") === disciplineFilter : true))
      .filter((p) => {
        if (!q) return true;
        const text = `${p.title} ${p.discipline || ""} ${p.venueName || ""} ${p.locationDetail || ""}`.toLowerCase();
        return text.includes(q);
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [premiaciones, eventFilter, statusFilter, disciplineFilter, search]);

  const kpis = useMemo(() => {
    let programadas = 0, realizadas = 0, pendientes = 0, awardersTotal = 0;
    premiaciones.forEach((p) => {
      if (p.status === "REALIZADA") realizadas++; else programadas++;
      (p.awarders || []).forEach((a) => {
        awardersTotal++;
        if (awarderState(a) === "PENDING") pendientes++;
      });
    });
    return { total: premiaciones.length, programadas, realizadas, pendientes, awardersTotal };
  }, [premiaciones]);

  // Candidatos a entregadores: VIP primero; si no hay VIP marcados, todos.
  const awarderCandidates = useMemo(() => {
    const vips = athletes.filter((a) => String(a.userType ?? "").toUpperCase() === "VIP");
    const base = vips.length > 0 ? vips : athletes;
    return [...base].sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
  }, [athletes]);

  const openEdit = (p: Premiacion) => {
    setEditing(p);
    setEditAwarders([...(p.awarders || [])]);
    setAddAthleteId("");
    setMessage(null);
  };

  const addAwarder = (athleteId: string) => {
    if (!athleteId) return;
    setEditAwarders((prev) =>
      prev.some((a) => a.athleteId === athleteId) ? prev : [...prev, { athleteId }],
    );
    setAddAthleteId("");
  };

  const removeAwarder = (athleteId: string) => {
    setEditAwarders((prev) => prev.filter((a) => a.athleteId !== athleteId));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    setMessage(null);
    try {
      const updated = await apiFetch<Premiacion>(`/premiaciones/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awarders: editAwarders.map((a) => ({ athleteId: a.athleteId })) }),
      });
      setPremiaciones((prev) => prev.map((x) => (x.id === editing.id ? { ...x, awarders: updated.awarders ?? [] } : x)));
      setEditing(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudieron guardar los entregadores.");
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleStatus = async (p: Premiacion) => {
    const next = p.status === "REALIZADA" ? "PROGRAMADA" : "REALIZADA";
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

  return (
    <div className="space-y-5 min-w-0 overflow-x-hidden">
      <PageHeader
        title="Premiaciones"
        description="Ceremonias de premiación por prueba, con sus entregadores VIP y el estado de confirmación de asistencia."
        icon={<TrophyIcon size={26} />}
        iconBg="linear-gradient(135deg, #fbbf24 0%, #d97706 100%)"
        accentStrip="gold"
        action={
          <Link href="/deportes" className="btn btn-primary text-xs">
            + Nueva desde Pruebas
          </Link>
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
      </section>

      {message && <p className="text-sm" style={{ color: "#b91c1c" }}>{message}</p>}

      {/* Lista */}
      {loading ? (
        <p className="text-sm" style={{ color: "#94a3b8" }}>Cargando premiaciones…</p>
      ) : visible.length === 0 ? (
        <div className="p-12 text-center rounded-2xl" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)", border: "1px dashed #e2e8f0" }}>
          <TrophyIcon size={36} color="#cbd5e1" />
          <p className="text-sm font-semibold mt-3" style={{ color: "#475569" }}>No hay premiaciones para mostrar</p>
          <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
            Se crean desde <Link href="/deportes" style={{ color: "#14b8a6", fontWeight: 600 }}>Deportes → Pruebas</Link>, activando la sección Premiación de una prueba.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visible.map((p) => {
            const st = STATUS_META[p.status] || STATUS_META.PROGRAMADA;
            const awarders = p.awarders || [];
            const confirmed = awarders.filter((a) => awarderState(a) === "CONFIRMED").length;
            return (
              <article key={p.id} className="surface rounded-2xl p-4 space-y-3"
                style={{ borderTop: `4px solid ${p.status === "REALIZADA" ? "#059669" : "#fbbf24"}` }}>
                {/* Encabezado */}
                <div className="flex items-start justify-between gap-2">
                  <div style={{ minWidth: 0 }}>
                    <p className="font-bold text-[15px] leading-tight" style={{ color: "#0f172a" }}>{p.title}</p>
                    {p.discipline && (
                      <p className="text-xs mt-0.5" style={{ color: "#14b8a6", fontWeight: 600 }}>{p.discipline}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => toggleStatus(p)} disabled={savingId === p.id}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all"
                    title="Cambiar estado"
                    style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}33`, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {savingId === p.id ? "…" : st.label}
                  </button>
                </div>

                {/* Datos */}
                <div className="text-xs space-y-0.5" style={{ color: "#64748b" }}>
                  <p>🗓 {fmtDateTime(p.scheduledAt)}</p>
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
                    ✎ Editar encargados
                  </button>
                  <Link href="/deportes" className="text-xs font-semibold" style={{ color: "#14b8a6" }}>
                    Editar prueba →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal: editar encargados VIP */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }}
          onClick={() => !savingEdit && setEditing(null)}>
          <div className="surface rounded-2xl p-5 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-bold" style={{ color: "#0f172a" }}>Entregadores VIP</h3>
              <p className="text-xs" style={{ color: "#94a3b8" }}>{editing.title}{editing.discipline ? ` · ${editing.discipline}` : ""}</p>
            </div>

            {/* Agregar entregador */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Agregar encargado</label>
              <StyledSelect value={addAthleteId} onChange={(e) => addAwarder(e.target.value)}>
                <option value="">Selecciona un VIP…</option>
                {awarderCandidates
                  .filter((a) => !editAwarders.some((e) => e.athleteId === a.id))
                  .map((a) => <option key={a.id} value={a.id}>{a.fullName || a.id.slice(0, 8)}</option>)}
              </StyledSelect>
            </div>

            {/* Lista actual */}
            <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#f8fafc", border: "1px solid #eef1f6", maxHeight: 260, overflowY: "auto" }}>
              {editAwarders.length === 0 ? (
                <p className="text-[12px]" style={{ color: "#94a3b8" }}>Sin entregadores. Agrega al menos uno.</p>
              ) : editAwarders.map((a) => {
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

            <p className="text-[11px]" style={{ color: "#94a3b8" }}>
              Las confirmaciones ya registradas se conservan al guardar. Sólo los entregadores nuevos empiezan como pendientes.
            </p>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost text-sm" onClick={() => setEditing(null)} disabled={savingEdit}>Cancelar</button>
              <button type="button" className="btn btn-primary text-sm" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? "Guardando…" : "Guardar encargados"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
