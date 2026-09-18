"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import StyledSelect from "@/components/StyledSelect";
import { PencilIcon, TrashIcon, UsersIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { CHILE_REGIONS, delegationLabel } from "@/lib/delegations";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";

/**
 * Registro de delegaciones del evento (pestaña de Inscripción de Participantes).
 * Una delegación es una región del país asociada al evento, con su Jefe de
 * Delegación: un participante inscrito (no un usuario del panel), que entra al
 * portal con su código. Sólo tres campos, por decisión de producto: evento,
 * región y jefe. La flota se asigna desde Conductores/Vehículos y los hoteles
 * se derivan de la asignación hotelera de los participantes.
 */
type EventRow = { id: string; name: string; disciplineIds?: string[] };
type DisciplineRow = { id: string; name?: string | null; gender?: string | null; category?: string | null };
type DelegationRow = {
  id: string;
  eventId: string;
  countryCode: string;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
  missionHeadId?: string | null;
  missionHeadName?: string | null;
  missionHeadPhone?: string | null;
  disciplineIds?: string[];
};
type AthleteRow = {
  id: string;
  eventId?: string | null;
  fullName?: string | null;
  delegationId?: string | null;
  isDelegationLead?: boolean | null;
  status?: string | null;
};

type Form = {
  id: string | null;
  eventId: string;
  countryCode: string;
  missionHeadId: string;
  /** Disciplinas con las que la región compite; acotan la disciplina del viaje. */
  disciplineIds: string[];
};
const emptyForm = (eventId = ""): Form => ({ id: null, eventId, countryCode: "", missionHeadId: "", disciplineIds: [] });

const GENERO: Record<string, string> = { MALE: "Masculino", FEMALE: "Femenino", MIXED: "Mixto" };
/** "Atletismo · Femenino · Paralímpica": el mismo deporte existe por género y categoría. */
const disciplinaLabel = (d: DisciplineRow) =>
  [d.name ?? d.id, d.gender ? GENERO[d.gender] ?? d.gender : null, d.category === "PARALYMPIC" ? "Paralímpica" : null]
    .filter(Boolean)
    .join(" · ");

const regionName = (code: string) => CHILE_REGIONS.find((r) => r.value === code)?.label ?? code;

export default function DelegationsRegistry({ refreshKey = 0, onChanged }: { refreshKey?: number; onChanged?: () => void }) {
  const { t } = useI18n();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [delegations, setDelegations] = useState<DelegationRow[]>([]);
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<DelegationRow | null>(null);

  const load = useCallback(async () => {
    try {
      const [ev, dl, at, di] = await Promise.all([
        apiFetch<EventRow[]>("/events"),
        apiFetch<DelegationRow[]>("/delegations"),
        apiFetch<AthleteRow[]>("/athletes").catch(() => [] as AthleteRow[]),
        apiFetch<DisciplineRow[]>("/disciplines").catch(() => [] as DisciplineRow[]),
      ]);
      setEvents(ev ?? []);
      setDelegations(dl ?? []);
      setAthletes((at ?? []).filter((a) => a.status !== "DELETED"));
      setDisciplines(di ?? []);
      // El evento vigente es el más reciente (GET /events ordena por creación).
      setForm((f) => (f.eventId ? f : emptyForm(ev?.[0]?.id ?? "")));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudieron cargar las delegaciones."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const rows = useMemo(
    () =>
      delegations
        .filter((d) => !form.eventId || d.eventId === form.eventId)
        .sort((a, b) => delegationLabel(a).localeCompare(delegationLabel(b))),
    [delegations, form.eventId],
  );
  const membersOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of athletes) if (a.delegationId) map.set(a.delegationId, (map.get(a.delegationId) ?? 0) + 1);
    return map;
  }, [athletes]);

  // Regiones aún libres para el evento (al editar se conserva la actual).
  const regionOptions = useMemo(() => {
    const taken = new Set(delegations.filter((d) => d.eventId === form.eventId && d.id !== form.id).map((d) => d.countryCode));
    return CHILE_REGIONS.filter((r) => !taken.has(r.value));
  }, [delegations, form.eventId, form.id]);

  // Sólo las disciplinas del evento elegido (core.event_disciplines).
  const disciplineOptions = useMemo(() => {
    const delEvento = events.find((e) => e.id === form.eventId)?.disciplineIds;
    const permitidas = new Set(delEvento ?? []);
    return disciplines
      .filter((d) => permitidas.size === 0 || permitidas.has(d.id))
      .sort((a, b) => disciplinaLabel(a).localeCompare(disciplinaLabel(b)));
  }, [disciplines, events, form.eventId]);

  // Jefe: participantes del evento en esta delegación o aún sin delegación.
  const headOptions = useMemo(
    () =>
      athletes
        .filter((a) => (!a.eventId || a.eventId === form.eventId) && (!a.delegationId || a.delegationId === form.id))
        .sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? "")),
    [athletes, form.eventId, form.id],
  );

  const startEdit = (d: DelegationRow) => {
    setForm({
      id: d.id,
      eventId: d.eventId,
      countryCode: d.countryCode,
      missionHeadId: d.missionHeadId ?? "",
      disciplineIds: d.disciplineIds ?? [],
    });
    setError(null);
  };
  const cancel = () => setForm(emptyForm(form.eventId));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.eventId || !form.countryCode) return;
    setSaving(true);
    try {
      const body = {
        eventId: form.eventId,
        countryCode: form.countryCode,
        name: regionName(form.countryCode),
        missionHeadId: form.missionHeadId || null,
        disciplineIds: form.disciplineIds,
      };
      await apiFetch(form.id ? `/delegations/${form.id}` : "/delegations", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setForm(emptyForm(form.eventId));
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo guardar la delegación."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await apiFetch(`/delegations/${toDelete.id}`, { method: "DELETE" });
      if (form.id === toDelete.id) setForm(emptyForm(form.eventId));
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo eliminar la delegación."));
    } finally {
      setToDelete(null);
    }
  };

  const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SURFACE.textMuted, marginBottom: 6 };

  return (
    <div className="space-y-4">
      <section className="surface" style={{ borderRadius: 14, padding: "18px 20px", borderTop: `2px solid ${BRAND.teal}`, boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: 4 }}>
          {form.id ? t("Editar delegación") : t("Nueva delegación")}
        </p>
        <p style={{ fontSize: 12.5, color: SURFACE.textMuted, margin: "0 0 14px" }}>
          {t("Cada delegación es una región asociada al evento con su Jefe de Delegación, que es un participante inscrito y entra al portal con su código. Choferes y vehículos se asignan a la región desde sus propios maestros; los hoteles se toman de la asignación hotelera de sus participantes.")}
        </p>

        {error && (
          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: STATE.dangerSoft, color: STATE.dangerText, border: `1px solid ${STATE.dangerBorder}`, fontSize: 12.5 }}>
            {error}
          </div>
        )}

        <form onSubmit={(e) => void submit(e)} className="grid gap-4 md:grid-cols-3">
          <label>
            <span style={labelStyle}>{t("Evento")}</span>
            <StyledSelect value={form.eventId} onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value, missionHeadId: "" }))} disabled={Boolean(form.id)}>
              <option value="">{t("Selecciona un evento")}</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </StyledSelect>
          </label>
          <label>
            <span style={labelStyle}>{t("Región")}</span>
            <StyledSelect value={form.countryCode} onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value }))}>
              <option value="">{regionOptions.length === 0 && !form.id ? t("Todas las regiones ya están registradas para este evento.") : t("Selecciona una región")}</option>
              {regionOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </StyledSelect>
          </label>
          <label>
            <span style={labelStyle}>{t("Jefe de Delegación")}</span>
            <StyledSelect value={form.missionHeadId} onChange={(e) => setForm((f) => ({ ...f, missionHeadId: e.target.value }))}>
              <option value="">{t("Sin asignar")}</option>
              {headOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {`${a.fullName ?? a.id}${!a.delegationId ? ` · ${t("sin delegación")}` : ""}`}
                </option>
              ))}
            </StyledSelect>
            <span style={{ display: "block", fontSize: 11, color: SURFACE.textFaint, marginTop: 4 }}>
              {t("Participante inscrito en el evento; queda como jefe y asociado a esta región.")}
            </span>
          </label>
          <div className="md:col-span-3">
            <span style={labelStyle}>{t("Disciplinas de la delegación")}</span>
            {disciplineOptions.length === 0 ? (
              <p style={{ fontSize: 12.5, color: SURFACE.textFaint, margin: 0 }}>
                {t("El evento aún no tiene disciplinas cargadas.")}
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {disciplineOptions.map((d) => {
                  const on = form.disciplineIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          disciplineIds: on
                            ? f.disciplineIds.filter((x) => x !== d.id)
                            : [...f.disciplineIds, d.id],
                        }))
                      }
                      style={{
                        padding: "5px 11px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: on ? BRAND.teal : SURFACE.card,
                        color: on ? "#fff" : SURFACE.textStrong,
                        border: `1px solid ${on ? BRAND.teal : SURFACE.border}`,
                      }}
                    >
                      {on ? "✓ " : ""}
                      {disciplinaLabel(d)}
                    </button>
                  );
                })}
              </div>
            )}
            <span style={{ display: "block", fontSize: 11, color: SURFACE.textFaint, marginTop: 6 }}>
              {t("Los viajes de esta delegación se asignan a una de estas disciplinas.")}
            </span>
          </div>
          <div className="md:col-span-3 flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving || !form.eventId || !form.countryCode}>
              {saving ? t("Guardando…") : form.id ? t("Guardar cambios") : t("Crear delegación")}
            </button>
            {form.id && (
              <button type="button" className="btn btn-ghost" onClick={cancel} disabled={saving}>
                {t("Cancelar")}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="surface" style={{ borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: 10 }}>
          {t("Delegaciones del evento")} · {rows.length}
        </p>
        {loading ? (
          <p style={{ fontSize: 13, color: SURFACE.textFaint, padding: 16, textAlign: "center" }}>{t("Cargando…")}</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 13, color: SURFACE.textFaint, padding: 16, textAlign: "center" }}>{t("No hay delegaciones registradas para este evento.")}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: SURFACE.textMuted }}>
                  <th style={{ padding: "8px 10px", borderBottom: `1px solid ${SURFACE.border}` }}>{t("Región")}</th>
                  <th style={{ padding: "8px 10px", borderBottom: `1px solid ${SURFACE.border}` }}>{t("Jefe de Delegación")}</th>
                  <th style={{ padding: "8px 10px", borderBottom: `1px solid ${SURFACE.border}` }}>{t("Disciplinas")}</th>
                  <th style={{ padding: "8px 10px", borderBottom: `1px solid ${SURFACE.border}`, textAlign: "right" }}>{t("Participantes")}</th>
                  <th style={{ padding: "8px 10px", borderBottom: `1px solid ${SURFACE.border}` }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} style={{ background: form.id === d.id ? "rgba(33,208,179,0.06)" : undefined }}>
                    <td style={{ padding: "10px", borderBottom: `1px solid ${SURFACE.borderMuted}`, fontWeight: 600, color: SURFACE.text }}>
                      {delegationLabel(d)}
                      <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: SURFACE.textFaint }}>{d.countryCode}</span>
                    </td>
                    <td style={{ padding: "10px", borderBottom: `1px solid ${SURFACE.borderMuted}`, color: d.missionHeadName ? SURFACE.text : SURFACE.textFaint }}>
                      {d.missionHeadName ?? t("Sin asignar")}
                      {d.missionHeadPhone && <span style={{ display: "block", fontSize: 11, color: SURFACE.textMuted }}>{d.missionHeadPhone}</span>}
                    </td>
                    <td style={{ padding: "10px", borderBottom: `1px solid ${SURFACE.borderMuted}`, fontSize: 12, color: (d.disciplineIds?.length ?? 0) > 0 ? SURFACE.textStrong : SURFACE.textFaint }}>
                      {(d.disciplineIds?.length ?? 0) > 0
                        ? (d.disciplineIds ?? [])
                            .map((id) => disciplines.find((x) => x.id === id))
                            .filter((x): x is DisciplineRow => Boolean(x))
                            .map((x) => disciplinaLabel(x))
                            .join(", ")
                        : t("Sin asignar")}
                    </td>
                    <td style={{ padding: "10px", borderBottom: `1px solid ${SURFACE.borderMuted}`, textAlign: "right", fontVariantNumeric: "tabular-nums", color: SURFACE.textStrong }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><UsersIcon size={13} /> {membersOf.get(d.id) ?? 0}</span>
                    </td>
                    <td style={{ padding: "10px", borderBottom: `1px solid ${SURFACE.borderMuted}`, whiteSpace: "nowrap", textAlign: "right" }}>
                      <button type="button" className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => startEdit(d)} title={t("Editar")}>
                        <PencilIcon size={14} />
                      </button>
                      <button type="button" className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12, color: STATE.dangerText }} onClick={() => setToDelete(d)} title={t("Eliminar")}>
                        <TrashIcon size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        title={t("Eliminar delegación")}
        message={`${toDelete ? delegationLabel(toDelete) : ""}. ${t("Los participantes asociados quedarán sin delegación.")}`}
        confirmLabel={t("Eliminar")}
        cancelLabel={t("Cancelar")}
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
