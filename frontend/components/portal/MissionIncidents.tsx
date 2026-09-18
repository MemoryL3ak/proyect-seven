"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon, SirenIcon } from "@/components/ui/Icons";
import { SegmentedFilter } from "@/components/ui/FilterControls";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BRAND, STATE, SURFACE } from "@/lib/design";

/**
 * Incidencias para el Jefe de Misión (portal): las ve y las reporta. El
 * backend fuerza su delegación al crear y acota la lista; acá sólo se arma la
 * UI. El jefe toma y resuelve; cerrar y eliminar quedan para operaciones.
 */
type Incident = {
  id: string;
  venueName: string | null;
  category: string;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  reportedByName: string | null;
  resolution: string | null;
  createdAt: string;
};

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
const STATUSES: Record<string, string> = { ABIERTA: "Abierta", EN_CURSO: "En curso", RESUELTA: "Resuelta", CERRADA: "Cerrada" };
const labelOf = (list: Array<[string, string]>, value: string) => list.find(([v]) => v === value)?.[1] ?? value;

const severityTone = (severity: string) =>
  severity === "CRITICA" || severity === "ALTA"
    ? { bg: STATE.dangerSoft, fg: STATE.dangerText, border: STATE.dangerBorder }
    : severity === "MEDIA"
      ? { bg: STATE.warningSoft, fg: STATE.warningText, border: STATE.warningBorder }
      : { bg: STATE.infoSoft, fg: STATE.infoText, border: STATE.infoBorder };
const statusTone = (status: string) =>
  status === "RESUELTA" || status === "CERRADA"
    ? { bg: STATE.successSoft, fg: STATE.successText, border: STATE.successBorder }
    : status === "EN_CURSO"
      ? { bg: STATE.infoSoft, fg: STATE.infoText, border: STATE.infoBorder }
      : { bg: STATE.warningSoft, fg: STATE.warningText, border: STATE.warningBorder };

const chip = (tone: { bg: string; fg: string; border: string }): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  background: tone.bg,
  color: tone.fg,
  border: `1px solid ${tone.border}`,
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${SURFACE.border}`,
  background: SURFACE.card,
  color: SURFACE.text,
  fontSize: 13,
};

const emptyForm = () => ({ title: "", category: "OTRO", severity: "MEDIA", venueId: "", description: "" });

export default function MissionIncidents({
  eventId,
  delegationName,
  venues,
}: {
  eventId?: string | null;
  delegationName: string;
  venues: Array<{ id: string; name?: string | null }>;
}) {
  const { t } = useI18n();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState<{ id: string; text: string } | null>(null);
  const [filtro, setFiltro] = useState<"ABIERTAS" | "RESUELTAS" | "TODAS">("ABIERTAS");

  const load = useCallback(async () => {
    try {
      const q = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
      const data = await apiFetch<Incident[]>(`/incidents${q}`);
      setIncidents(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudieron cargar las incidencias."));
    } finally {
      setLoading(false);
    }
  }, [eventId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: eventId || undefined,
          title: form.title.trim(),
          category: form.category,
          severity: form.severity,
          venueId: form.venueId || undefined,
          description: form.description.trim() || undefined,
        }),
      });
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo reportar la incidencia."));
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      await apiFetch(`/incidents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setResolving(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo actualizar la incidencia."));
    }
  };

  const abierta = (i: Incident) => i.status === "ABIERTA" || i.status === "EN_CURSO";
  const open = incidents.filter(abierta);
  const visibles = incidents.filter((i) =>
    filtro === "ABIERTAS" ? abierta(i) : filtro === "RESUELTAS" ? !abierta(i) : true,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, padding: 14, borderLeft: `4px solid ${STATE.warning}` }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: STATE.warning, margin: "0 0 6px" }}>{t("Incidencias de mi delegación")}</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{delegationName || "—"}</p>
        <p style={{ fontSize: 12, color: SURFACE.textMuted, margin: "3px 0 0" }}>
          {open.length} {t("abierta(s)")} · {incidents.length} {t("en total")}
        </p>
        {incidents.length > 0 && (
          <SegmentedFilter
            style={{ marginTop: 10 }}
            value={filtro}
            onChange={(value) => setFiltro(value as "ABIERTAS" | "RESUELTAS" | "TODAS")}
            options={[
              { value: "ABIERTAS", label: t("Abiertas"), count: open.length },
              { value: "RESUELTAS", label: t("Resueltas"), count: incidents.length - open.length },
              { value: "TODAS", label: t("Todas") },
            ]}
          />
        )}
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 12, background: STATE.dangerSoft, color: STATE.dangerText, border: `1px solid ${STATE.dangerBorder}`, fontSize: 12.5 }}>
          {error}
        </div>
      )}

      {!showForm ? (
        <button type="button" className="btn btn-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setShowForm(true)}>
          <PlusIcon size={16} /> {t("Reportar incidencia")}
        </button>
      ) : (
        <form onSubmit={(e) => void submit(e)} style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{t("Nueva incidencia")}</p>
          <input
            style={inputStyle}
            placeholder={t("¿Qué pasó? (título breve)")}
            value={form.title}
            maxLength={200}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <div style={{ display: "flex", gap: 8 }}>
            <select style={inputStyle} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(([v, l]) => (
                <option key={v} value={v}>{t(l)}</option>
              ))}
            </select>
            <select style={inputStyle} value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
              {SEVERITIES.map(([v, l]) => (
                <option key={v} value={v}>{t(l)}</option>
              ))}
            </select>
          </div>
          <select style={inputStyle} value={form.venueId} onChange={(e) => setForm((f) => ({ ...f, venueId: e.target.value }))}>
            <option value="">{t("Sede (opcional)")}</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name || v.id}</option>
            ))}
          </select>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
            placeholder={t("Detalle: dónde, cuándo, a quién afecta")}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowForm(false); setForm(emptyForm()); }} disabled={saving}>
              {t("Cancelar")}
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving || !form.title.trim()}>
              {saving ? t("Enviando…") : t("Reportar")}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: SURFACE.textFaint, textAlign: "center", padding: 20 }}>{t("Cargando…")}</p>
      ) : visibles.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}` }}>
          <SirenIcon size={22} color={SURFACE.textFaint} />
          <p style={{ fontSize: 13, color: SURFACE.textFaint, margin: "6px 0 0" }}>
            {incidents.length === 0
              ? t("Sin incidencias reportadas para tu delegación.")
              : t("Ninguna incidencia coincide con el filtro.")}
          </p>
        </div>
      ) : (
        visibles.map((i) => {
          const isOpen = i.status === "ABIERTA" || i.status === "EN_CURSO";
          return (
            <div key={i.id} style={{ background: SURFACE.card, borderRadius: 12, border: `1px solid ${SURFACE.border}`, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={chip(statusTone(i.status))}>{t(STATUSES[i.status] ?? i.status)}</span>
                <span style={chip(severityTone(i.severity))}>{t(labelOf(SEVERITIES, i.severity))}</span>
                <span style={{ ...chip({ bg: SURFACE.borderMuted, fg: SURFACE.textMuted, border: SURFACE.border }) }}>{t(labelOf(CATEGORIES, i.category))}</span>
              </div>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{i.title}</p>
              {i.description && <p style={{ fontSize: 12, color: SURFACE.textStrong, margin: 0, whiteSpace: "pre-wrap" }}>{i.description}</p>}
              <p style={{ fontSize: 11, color: SURFACE.textMuted, margin: 0 }}>
                {new Date(i.createdAt).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                {i.venueName ? ` · ${i.venueName}` : ""}
                {i.reportedByName ? ` · ${i.reportedByName}` : ""}
              </p>
              {i.resolution && (
                <p style={{ fontSize: 12, color: STATE.successText, margin: 0 }}>
                  <strong>{t("Resolución")}:</strong> {i.resolution}
                </p>
              )}
              {isOpen && resolving?.id !== i.id && (
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {i.status === "ABIERTA" && (
                    <button type="button" className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => void patch(i.id, { status: "EN_CURSO" })}>
                      {t("Tomar")}
                    </button>
                  )}
                  <button type="button" className="btn btn-primary" style={{ flex: 1, fontSize: 12 }} onClick={() => setResolving({ id: i.id, text: "" })}>
                    {t("Resolver")}
                  </button>
                </div>
              )}
              {resolving?.id === i.id && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  <textarea
                    style={{ ...inputStyle, minHeight: 60 }}
                    placeholder={t("¿Cómo se resolvió?")}
                    value={resolving.text}
                    onChange={(e) => setResolving({ id: i.id, text: e.target.value })}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => setResolving(null)}>{t("Cancelar")}</button>
                    <button type="button" className="btn btn-primary" style={{ flex: 1, fontSize: 12, background: BRAND.teal }} onClick={() => void patch(i.id, { status: "RESUELTA", resolution: resolving.text.trim() || undefined })}>
                      {t("Marcar resuelta")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
