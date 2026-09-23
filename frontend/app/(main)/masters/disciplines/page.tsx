"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import StyledSelect from "@/components/StyledSelect";
import {
  AccessibilityIcon,
  ChevronRightIcon,
  PencilIcon,
  TrashIcon,
  TrophyIcon,
} from "@/components/ui/Icons";
import { iconoDeDisciplina } from "@/lib/disciplina-icono";

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
  FEMALE: "Femenino",
  // Las disciplinas sin rama —ajedrez, natación, tenis de mesa— se cargan como
  // mixtas. Faltaba acá y no había forma de registrarlas desde esta pantalla.
  MIXED: "Mixto"
};

const EMPTY_FORM = {
  name: "",
  eventId: "",
  category: "",
  gender: "",
  parentId: ""
};

/** Rótulo de campo del formulario: el mismo en los cinco. */
const etiquetaCampo = "flex flex-col gap-1 text-xs uppercase tracking-widest";

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

  /**
   * Categoría y rama como pastillas y no como un texto gris corrido.
   *
   * La categoría se pinta sólo cuando aporta algo: en la fila de una prueba se
   * omite si es la misma del deporte que la contiene, que es el caso normal
   * —repetir "Paralímpica" en cada una de las cuatro filas de un deporte
   * paralímpico es ruido—. Se muestra cuando difiere, que es justo el dato que
   * conviene que salte a la vista.
   *
   * La rama va en pastilla neutra a propósito: colorearla por género sería
   * decorar un dato con un estereotipo.
   */
  const chips = (d: Discipline, categoriaDelPadre?: string | null) => {
    const categoria = CATEGORY_LABELS[d.category ?? ""] ?? d.category;
    const rama = GENDER_LABELS[d.gender ?? ""] ?? d.gender;
    const mostrarCategoria = categoria && d.category !== categoriaDelPadre;
    return (
      <span className="flex items-center gap-1.5 flex-shrink-0">
        {mostrarCategoria && (
          <span className={`badge ${d.category === "PARALYMPIC" ? "badge-blue" : "badge-slate"}`}>
            {t(categoria as string)}
          </span>
        )}
        {rama && <span className="badge badge-slate">{t(rama as string)}</span>}
      </span>
    );
  };

  /**
   * El icono dice qué deporte es —caballo de ajedrez, zapatilla, balón—, no si
   * es convencional o paralímpico: eso ya lo dice la pastilla de al lado, y
   * gastar el icono en repetirlo dejaba a Ajedrez con una pesa.
   *
   * En los paralímpicos se marca la esquina con el símbolo de accesibilidad,
   * que suma sin tapar el deporte.
   */
  const iconoDeporte = (d: Discipline) => {
    const Icono = iconoDeDisciplina(d.name);
    const esPara = d.category === "PARALYMPIC";
    return (
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{ position: "relative", width: 34, height: 34, borderRadius: 10, background: "rgba(33,208,179,0.10)", color: BRAND.tealInk }}
        title={d.name}
      >
        <Icono size={17} strokeWidth={2} />
        {esPara && (
          <span
            className="flex items-center justify-center"
            style={{
              position: "absolute", right: -4, bottom: -4, width: 15, height: 15, borderRadius: "50%",
              background: SURFACE.card, border: `1px solid ${STATE.infoBorder}`, color: STATE.infoText,
            }}
          >
            <AccessibilityIcon size={9} strokeWidth={2.4} />
          </span>
        )}
      </span>
    );
  };

  /** Los botones de editar y borrar, iguales en el deporte y en la prueba. */
  const accionesFila = (d: Discipline, size: number) => (
    <>
      <button
        onClick={() => openEdit(d)}
        className="p-1.5 transition-colors"
        style={{ color: SURFACE.textFaint }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = SURFACE.text; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = SURFACE.textFaint; }}
        title={t("Editar")}
      >
        <PencilIcon size={size} strokeWidth={2} />
      </button>
      <button
        onClick={() => remove(d)}
        className="p-1.5 transition-colors"
        style={{ color: SURFACE.textFaint }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = STATE.danger; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = SURFACE.textFaint; }}
        title={t("Eliminar")}
      >
        <TrashIcon size={size} strokeWidth={2} />
      </button>
    </>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm" style={{ color: SURFACE.textFaint }}>
        {t("Cargando disciplinas…")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="glass rounded-3xl p-4 md:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: SURFACE.textFaint }}>Masters</p>
          <h1 className="font-sans font-bold text-2xl md:text-3xl" style={{ color: SURFACE.text }}>{t("Disciplinas")}</h1>
          <p className="text-sm mt-1" style={{ color: SURFACE.textMuted }}>
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
          <div className="surface rounded-2xl p-10 text-center" style={{ color: SURFACE.textFaint }}>
            <TrophyIcon size={28} strokeWidth={1.6} style={{ margin: "0 auto 10px", display: "block" }} />
            <p className="text-sm">{t("No hay deportes registrados. Agrega uno para comenzar.")}</p>
          </div>
        )}

        {sports.map(sport => {
          const subs = subsOf(sport.id);
          const open = expanded.has(sport.id);
          return (
            <div key={sport.id} className="surface rounded-2xl overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 py-4">
                <button
                  onClick={() => toggle(sport.id)}
                  className="flex items-center gap-3 flex-[1_1_220px] text-left min-w-0"
                >
                  <span
                    className="flex-shrink-0 transition-transform"
                    style={{ color: SURFACE.textFaint, transform: open ? "rotate(90deg)" : "none", display: "inline-flex" }}
                  >
                    <ChevronRightIcon size={16} strokeWidth={2} />
                  </span>
                  {iconoDeporte(sport)}
                  <span className="font-semibold truncate" style={{ fontSize: 15, color: SURFACE.text }}>{sport.name}</span>
                  {chips(sport)}
                  <span className="ml-auto flex-shrink-0 pr-2">
                    <span className={`badge ${subs.length > 0 ? "badge-gold" : "badge-slate"}`}>
                      {subs.length} {subs.length === 1 ? t("prueba") : t("pruebas")}
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => openAddSub(sport.id)}
                    className="btn btn-ghost text-xs py-1 px-3"
                  >
                    {t("+ Prueba")}
                  </button>
                  {accionesFila(sport, 16)}
                </div>
              </div>

              {open && (
                <div style={{ borderTop: `1px solid ${SURFACE.borderMuted}` }}>
                  {subs.length === 0 ? (
                    <p className="px-5 md:px-14 py-3 text-xs italic" style={{ color: SURFACE.textFaint }}>
                      {t("Sin pruebas. Haz clic en \"+ Prueba\" para agregar.")}
                    </p>
                  ) : (
                    <div>
                      {subs.map((sub, i) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-3 px-5 md:px-14 py-2.5 transition-colors"
                          style={i > 0 ? { borderTop: `1px solid ${SURFACE.borderMuted}` } : undefined}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = SURFACE.bg; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
                        >
                          <span
                            className="flex-shrink-0"
                            style={{ width: 5, height: 5, borderRadius: "50%", background: SURFACE.borderStrong }}
                          />
                          <span className="text-sm flex-1 truncate" style={{ color: SURFACE.textStrong, fontWeight: 500 }}>
                            {sub.name}
                          </span>
                          {chips(sub, sport.category)}
                          {accionesFila(sub, 14)}
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
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: STATE.warning }}>{t("Sin deporte asignado")}</p>
            <div>
              {orphans.map((d, i) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 px-2 py-2.5"
                  style={i > 0 ? { borderTop: `1px solid ${SURFACE.borderMuted}` } : undefined}
                >
                  <span className="text-sm flex-1 truncate" style={{ color: SURFACE.textStrong, fontWeight: 500 }}>{d.name}</span>
                  {chips(d)}
                  {accionesFila(d, 14)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="surface rounded-3xl p-5 md:p-6 w-full max-w-md space-y-4 max-h-[calc(100dvh-32px)] overflow-y-auto">
            <h2 className="font-bold text-xl" style={{ color: SURFACE.text }}>
              {modal.editing
                ? t(modal.mode === "sport" ? "Editar deporte" : "Editar prueba")
                : t(modal.mode === "sport" ? "Nuevo deporte" : "Nueva prueba")}
            </h2>

            <label className={etiquetaCampo} style={{ color: SURFACE.textFaint }}>
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
              <label className={etiquetaCampo} style={{ color: SURFACE.textFaint }}>
                {t("Deporte padre")}
                <StyledSelect
                  value={form.parentId}
                  onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
                >
                  <option value="">{t("— Sin deporte padre —")}</option>
                  {sports
                    .filter(s => s.id !== modal.editing?.id)
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </StyledSelect>
              </label>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className={etiquetaCampo} style={{ color: SURFACE.textFaint }}>
                {t("Categoría")}
                <StyledSelect
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="CONVENTIONAL">{t("Convencional")}</option>
                  <option value="PARALYMPIC">{t("Paralímpica")}</option>
                </StyledSelect>
              </label>
              <label className={etiquetaCampo} style={{ color: SURFACE.textFaint }}>
                {t("Género")}
                <StyledSelect
                  value={form.gender}
                  onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="MALE">{t("Masculino")}</option>
                  <option value="FEMALE">{t("Femenino")}</option>
                  <option value="MIXED">{t("Mixto")}</option>
                </StyledSelect>
              </label>
            </div>

            <label className={etiquetaCampo} style={{ color: SURFACE.textFaint }}>
              {t("Evento")}
              <StyledSelect
                value={form.eventId}
                onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}
              >
                <option value="">{t("— Todos los eventos —")}</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>
                ))}
              </StyledSelect>
            </label>

            {error && <p className="text-sm" style={{ color: STATE.danger }}>{error}</p>}

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
