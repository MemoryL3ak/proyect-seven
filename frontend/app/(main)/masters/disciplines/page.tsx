"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Discipline = {
  id: string;
  name: string;
  eventId?: string | null;
  category?: string | null;
  gender?: string | null;
  parentId?: string | null;
};

type EventItem = { id: string; name?: string | null };

const CATEGORY_LABELS: Record<string, string> = {
  CONVENTIONAL: "Convencional",
  PARALYMPIC: "Paralímpica"
};

const GENDER_LABELS: Record<string, string> = {
  MALE: "Masculino",
  FEMALE: "Femenino"
};

const EMPTY_FORM = {
  name: "",
  eventId: "",
  category: "",
  gender: "",
  parentId: ""
};

export default function DisciplinesPage() {
  const { t } = useI18n();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [modal, setModal] = useState<null | {
    mode: "sport" | "sub";
    editing?: Discipline;
    parentId?: string;
  }>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [d, e] = await Promise.all([
        apiFetch<Discipline[]>("/disciplines"),
        apiFetch<EventItem[]>("/events")
      ]);
      setDisciplines(d);
      setEvents(e);
      setExpanded(new Set(d.filter(x => !x.parentId).map(x => x.id)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sports = disciplines.filter(d => !d.parentId);
  const subsOf = (sportId: string) => disciplines.filter(d => d.parentId === sportId);
  const orphans = disciplines.filter(d => d.parentId && !disciplines.find(s => s.id === d.parentId));

  const openAddSport = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setModal({ mode: "sport" });
  };

  const openAddSub = (parentId: string) => {
    setForm({ ...EMPTY_FORM, parentId });
    setError(null);
    setModal({ mode: "sub", parentId });
  };

  const openEdit = (d: Discipline) => {
    setForm({
      name: d.name,
      eventId: d.eventId ?? "",
      category: d.category ?? "",
      gender: d.gender ?? "",
      parentId: d.parentId ?? ""
    });
    setError(null);
    setModal({ mode: d.parentId ? "sub" : "sport", editing: d });
  };

  const save = async () => {
    if (!form.name.trim()) { setError("El nombre es requerido."); return; }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string | null> = {
        name: form.name.trim(),
        eventId: form.eventId || null,
        category: form.category || null,
        gender: form.gender || null,
        parentId: form.parentId || null
      };
      if (modal?.editing) {
        await apiFetch(`/disciplines/${modal.editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      } else {
        await apiFetch("/disciplines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      }
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d: Discipline) => {
    const label = d.parentId ? `la prueba "${d.name}"` : `el deporte "${d.name}" y todas sus pruebas`;
    if (!confirm(`¿Eliminar ${label}?`)) return;
    try {
      await apiFetch(`/disciplines/${d.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const badge = (d: Discipline) =>
    [CATEGORY_LABELS[d.category ?? ""] ?? d.category, GENDER_LABELS[d.gender ?? ""] ?? d.gender]
      .filter(Boolean).map(s => t(s as string)).join(" · ");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-white/40 text-sm">
        {t("Cargando disciplinas…")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="glass rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">Masters</p>
          <h1 className="font-sans font-bold text-3xl text-white">{t("Disciplinas")}</h1>
          <p className="text-sm text-white/50 mt-1">
            {t("Organiza deportes y sus pruebas (ej: Atletismo → 100m planos, 4×100…)")}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAddSport}>
          {t("+ Nuevo deporte")}
        </button>
      </section>

      {/* Sport cards */}
      <div className="space-y-3">
        {sports.length === 0 && (
          <div className="surface rounded-2xl p-8 text-center text-white/40 text-sm">
            {t("No hay deportes registrados. Agrega uno para comenzar.")}
          </div>
        )}

        {sports.map(sport => {
          const subs = subsOf(sport.id);
          const open = expanded.has(sport.id);
          return (
            <div key={sport.id} className="surface rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                <button
                  onClick={() => toggle(sport.id)}
                  className="flex items-center gap-3 flex-1 text-left min-w-0"
                >
                  <svg
                    className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${open ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-semibold text-white truncate">{sport.name}</span>
                  {badge(sport) && (
                    <span className="text-xs text-white/35 flex-shrink-0">{badge(sport)}</span>
                  )}
                  <span className="ml-auto text-xs text-white/25 flex-shrink-0 pr-2">
                    {subs.length} {subs.length === 1 ? t("prueba") : t("pruebas")}
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openAddSub(sport.id)}
                    className="btn btn-ghost text-xs py-1 px-3"
                  >
                    {t("+ Prueba")}
                  </button>
                  <button onClick={() => openEdit(sport)} className="text-white/30 hover:text-white/70 transition-colors p-1.5" title="Editar">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => remove(sport)} className="text-white/20 hover:text-rose-400 transition-colors p-1.5" title="Eliminar">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {open && (
                <div className="border-t border-white/5">
                  {subs.length === 0 ? (
                    <p className="px-14 py-3 text-xs text-white/25 italic">
                      {t("Sin pruebas. Haz clic en \"+ Prueba\" para agregar.")}
                    </p>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {subs.map(sub => (
                        <div key={sub.id} className="flex items-center gap-3 px-14 py-2.5">
                          <span className="text-sm text-white/75 flex-1">{sub.name}</span>
                          {badge(sub) && (
                            <span className="text-xs text-white/25">{badge(sub)}</span>
                          )}
                          <button onClick={() => openEdit(sub)} className="text-white/20 hover:text-white/60 transition-colors p-1">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => remove(sub)} className="text-white/15 hover:text-rose-400 transition-colors p-1">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

        {orphans.length > 0 && (
          <div className="surface rounded-2xl p-4">
            <p className="text-xs uppercase tracking-widest text-amber-400/70 mb-3">{t("Sin deporte asignado")}</p>
            <div className="divide-y divide-white/5">
              {orphans.map(d => (
                <div key={d.id} className="flex items-center gap-3 py-2">
                  <span className="text-sm text-white/60 flex-1">{d.name}</span>
                  <button onClick={() => openEdit(d)} className="text-white/30 hover:text-white/70 p-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => remove(d)} className="text-white/20 hover:text-rose-400 p-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="surface rounded-3xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-bold text-xl text-white">
              {modal.editing
                ? t(modal.mode === "sport" ? "Editar deporte" : "Editar prueba")
                : t(modal.mode === "sport" ? "Nuevo deporte" : "Nueva prueba")}
            </h2>

            <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-white/40">
              {t("Nombre *")}
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={modal.mode === "sport" ? "ej: Atletismo" : "ej: 100 metros planos"}
                autoFocus
              />
            </label>

            {(modal.mode === "sub" || (modal.editing && form.parentId !== undefined)) && (
              <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-white/40">
                {t("Deporte padre")}
                <select
                  className="input"
                  value={form.parentId}
                  onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
                >
                  <option value="">{t("— Sin deporte padre —")}</option>
                  {sports
                    .filter(s => s.id !== modal.editing?.id)
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-white/40">
                {t("Categoría")}
                <select
                  className="input"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="CONVENTIONAL">{t("Convencional")}</option>
                  <option value="PARALYMPIC">{t("Paralímpica")}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-white/40">
                {t("Género")}
                <select
                  className="input"
                  value={form.gender}
                  onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="MALE">{t("Masculino")}</option>
                  <option value="FEMALE">{t("Femenino")}</option>
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-white/40">
              {t("Evento")}
              <select
                className="input"
                value={form.eventId}
                onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}
              >
                <option value="">{t("— Todos los eventos —")}</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>
                ))}
              </select>
            </label>

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button className="btn btn-ghost" onClick={() => setModal(null)} disabled={saving}>
                {t("Cancelar")}
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? t("Guardando…") : t("Guardar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
