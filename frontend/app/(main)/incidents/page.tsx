"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiFetch, getStoredUser } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { STATE, SURFACE } from "@/lib/design";
import { delegationLabel, type DelegationLike } from "@/lib/delegations";

/**
 * Incidencias del evento. Operaciones ve todas; un Jefe de Misión (usuario con
 * delegación en su metadata) ve y reporta sólo las de su región: el backend
 * acota la lista y fuerza la delegación al crear, acá sólo se adapta la UI.
 */
type Incident = {
  id: string;
  eventId: string | null;
  delegationId: string | null;
  delegationName: string | null;
  venueId: string | null;
  venueName: string | null;
  category: string;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  reportedByName: string | null;
  reportedByRole: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

type Option = { id: string; label: string };

const CATEGORIES: Array<[string, string]> = [
  ["TRANSPORTE", "Transporte"],
  ["SEDE", "Sede"],
  ["ALIMENTACION", "Alimentación"],
  ["ALOJAMIENTO", "Alojamiento"],
  ["SALUD", "Salud"],
  ["SEGURIDAD", "Seguridad"],
  ["OTRO", "Otro"],
];
const SEVERITIES: Array<[string, string]> = [
  ["BAJA", "Baja"],
  ["MEDIA", "Media"],
  ["ALTA", "Alta"],
  ["CRITICA", "Crítica"],
];
const STATUSES: Array<[string, string]> = [
  ["ABIERTA", "Abierta"],
  ["EN_CURSO", "En curso"],
  ["RESUELTA", "Resuelta"],
  ["CERRADA", "Cerrada"],
];
const label = (list: Array<[string, string]>, value: string) => list.find(([v]) => v === value)?.[1] ?? value;

const severityStyle = (severity: string): React.CSSProperties => {
  const tone =
    severity === "CRITICA" || severity === "ALTA"
      ? { bg: STATE.dangerSoft, fg: STATE.dangerText, border: STATE.dangerBorder }
      : severity === "MEDIA"
        ? { bg: STATE.warningSoft, fg: STATE.warningText, border: STATE.warningBorder }
        : { bg: STATE.infoSoft, fg: STATE.infoText, border: STATE.infoBorder };
  return { background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}` };
};
const statusStyle = (status: string): React.CSSProperties => {
  const tone =
    status === "RESUELTA" || status === "CERRADA"
      ? { bg: STATE.successSoft, fg: STATE.successText, border: STATE.successBorder }
      : status === "EN_CURSO"
        ? { bg: STATE.infoSoft, fg: STATE.infoText, border: STATE.infoBorder }
        : { bg: STATE.warningSoft, fg: STATE.warningText, border: STATE.warningBorder };
  return { background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}` };
};

const chip: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const emptyForm = () => ({
  title: "",
  category: "OTRO",
  severity: "MEDIA",
  description: "",
  venueId: "",
  delegationId: "",
});

export default function IncidentsPage() {
  const { t } = useI18n();
  const [scope, setScope] = useState<{ delegationId: string; delegationLabel: string } | null>(null);
  const [scopeReady, setScopeReady] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [delegationFilter, setDelegationFilter] = useState("");
  const [venues, setVenues] = useState<Option[]>([]);
  const [delegations, setDelegations] = useState<Option[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    const meta = user?.user_metadata ?? {};
    if (typeof meta.delegationId === "string" && meta.delegationId) {
      setScope({
        delegationId: meta.delegationId,
        delegationLabel: typeof meta.delegationLabel === "string" ? meta.delegationLabel : "",
      });
    }
    setScopeReady(true);
  }, []);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (!scope && delegationFilter) params.set("delegationId", delegationFilter);
      const qs = params.toString();
      const data = await apiFetch<Incident[]>(`/incidents${qs ? `?${qs}` : ""}`);
      setIncidents(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudieron cargar las incidencias."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, delegationFilter, scope, t]);

  useEffect(() => {
    if (!scopeReady) return;
    setLoading(true);
    void load();
  }, [scopeReady, load]);

  useEffect(() => {
    apiFetch<Array<Record<string, unknown>>>("/venues")
      .then((rows) =>
        setVenues(
          (rows || [])
            .map((v) => ({ id: String(v.id), label: typeof v.name === "string" ? v.name : "" }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        ),
      )
      .catch(() => setVenues([]));
    apiFetch<Array<Record<string, unknown>>>("/delegations")
      .then((rows) =>
        setDelegations(
          (rows || [])
            .map((d) => ({ id: String(d.id), label: delegationLabel(d as DelegationLike) }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        ),
      )
      .catch(() => setDelegations([]));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const created = await apiFetch<Incident>("/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category,
          severity: form.severity,
          description: form.description.trim() || null,
          venueId: form.venueId || null,
          ...(scope ? {} : { delegationId: form.delegationId || null }),
        }),
      });
      setIncidents((prev) => [created, ...prev]);
      setForm(emptyForm());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo guardar la incidencia."));
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      const updated = await apiFetch<Incident>(`/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setIncidents((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setResolving(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo actualizar la incidencia."));
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("¿Eliminar esta incidencia?"))) return;
    try {
      await apiFetch(`/incidents/${id}`, { method: "DELETE" });
      setIncidents((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo eliminar la incidencia."));
    }
  };

  const openCount = useMemo(
    () => incidents.filter((i) => i.status === "ABIERTA" || i.status === "EN_CURSO").length,
    [incidents],
  );

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Incidencias")}
        description={
          scope
            ? `${t("Delegación")}: ${scope.delegationLabel || t("tu región")} · ${openCount} ${t("abiertas")}`
            : `${openCount} ${t("abiertas")}`
        }
      />

      {/* ── Reportar ── */}
      <section className="surface rounded-2xl p-6">
        <h4 className="font-display text-xl text-ink mb-4">{t("Reportar incidencia")}</h4>
        <form onSubmit={(e) => void submit(e)} className="grid gap-3 md:grid-cols-2">
          <input
            className="input md:col-span-2"
            placeholder={t("Título breve (qué pasó)")}
            value={form.title}
            maxLength={180}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>{t(l)}</option>
            ))}
          </select>
          <select className="input" value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
            {SEVERITIES.map(([v, l]) => (
              <option key={v} value={v}>{t("Gravedad")}: {t(l)}</option>
            ))}
          </select>
          <select className="input" value={form.venueId} onChange={(e) => setForm((f) => ({ ...f, venueId: e.target.value }))}>
            <option value="">{t("Sede (opcional)")}</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
          {scope ? (
            <input className="input" value={scope.delegationLabel || t("Mi delegación")} readOnly />
          ) : (
            <select className="input" value={form.delegationId} onChange={(e) => setForm((f) => ({ ...f, delegationId: e.target.value }))}>
              <option value="">{t("Delegación (opcional)")}</option>
              {delegations.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          )}
          <textarea
            className="input min-h-[100px] md:col-span-2"
            placeholder={t("Describe el incidente, impacto y acciones tomadas...")}
            value={form.description}
            maxLength={4000}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="md:col-span-2">
            <button className="btn btn-primary w-fit" type="submit" disabled={saving || !form.title.trim()}>
              {saving ? t("Guardando…") : t("Reportar")}
            </button>
          </div>
        </form>
      </section>

      {/* ── Lista ── */}
      <section className="surface rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h4 className="font-display text-xl text-ink mr-auto">{t("Incidencias")}</h4>
          <select className="input max-w-[200px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("Todos los estados")}</option>
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>{t(l)}</option>
            ))}
          </select>
          {!scope && (
            <select className="input max-w-[260px]" value={delegationFilter} onChange={(e) => setDelegationFilter(e.target.value)}>
              <option value="">{t("Todas las delegaciones")}</option>
              {delegations.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="text-sm mb-3" style={{ color: STATE.dangerText }}>{error}</p>}
        {loading ? (
          <p className="text-sm text-slate-500">{t("Cargando…")}</p>
        ) : incidents.length === 0 ? (
          <p className="text-sm text-slate-500">{t("Sin incidencias registradas.")}</p>
        ) : (
          <ul className="space-y-3">
            {incidents.map((i) => {
              const closed = i.status === "RESUELTA" || i.status === "CERRADA";
              return (
                <li key={i.id} className="rounded-xl p-4" style={{ border: `1px solid ${SURFACE.border}`, background: SURFACE.card }}>
                  <div className="flex flex-wrap items-start gap-2">
                    <span style={{ ...chip, ...severityStyle(i.severity) }}>{t(label(SEVERITIES, i.severity))}</span>
                    <span style={{ ...chip, ...statusStyle(i.status) }}>{t(label(STATUSES, i.status))}</span>
                    <span className="text-xs text-slate-500">{t(label(CATEGORIES, i.category))}</span>
                    <span className="text-xs text-slate-400 ml-auto">{fmtDate(i.createdAt)}</span>
                  </div>
                  <p className="font-semibold text-ink mt-2">{i.title}</p>
                  {i.description && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{i.description}</p>}
                  <p className="text-xs text-slate-500 mt-2">
                    {[
                      i.delegationName ? `${t("Delegación")}: ${i.delegationName}` : null,
                      i.venueName ? `${t("Sede")}: ${i.venueName}` : null,
                      i.reportedByName ? `${t("Reportó")}: ${i.reportedByName}${i.reportedByRole ? ` (${i.reportedByRole})` : ""}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {i.resolution && (
                    <p className="text-sm mt-2" style={{ color: STATE.successText }}>
                      {t("Resolución")}: {i.resolution}
                    </p>
                  )}

                  {!closed && (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {i.status === "ABIERTA" && (
                        <button className="btn" type="button" onClick={() => void patch(i.id, { status: "EN_CURSO" })}>
                          {t("Tomar")}
                        </button>
                      )}
                      {resolving?.id === i.id ? (
                        <>
                          <input
                            className="input flex-1 min-w-[220px]"
                            placeholder={t("Cómo se resolvió")}
                            value={resolving.text}
                            onChange={(e) => setResolving({ id: i.id, text: e.target.value })}
                            autoFocus
                          />
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => void patch(i.id, { status: "RESUELTA", resolution: resolving.text || null })}
                          >
                            {t("Confirmar")}
                          </button>
                          <button className="btn" type="button" onClick={() => setResolving(null)}>{t("Cancelar")}</button>
                        </>
                      ) : (
                        <button className="btn" type="button" onClick={() => setResolving({ id: i.id, text: "" })}>
                          {t("Resolver")}
                        </button>
                      )}
                      {!scope && (
                        <button className="btn" type="button" onClick={() => void remove(i.id)} style={{ color: STATE.dangerText }}>
                          {t("Eliminar")}
                        </button>
                      )}
                    </div>
                  )}
                  {closed && !scope && i.status === "RESUELTA" && (
                    <div className="mt-3">
                      <button className="btn" type="button" onClick={() => void patch(i.id, { status: "CERRADA" })}>
                        {t("Cerrar")}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
