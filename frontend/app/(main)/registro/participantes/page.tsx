"use client";

import { useState, useEffect } from "react";
import BulkImportPanel from "@/components/BulkImportPanel";
import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Athlete = {
  id: string;
  fullName?: string | null;
  delegationId?: string | null;
  accreditationStatus?: string | null;
  passportNumber?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

type Delegation = {
  id: string;
  countryCode?: string | null;
};

function KpiCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div
      className="surface rounded-2xl p-5 flex flex-col gap-1"
      style={{
        borderTop: `2px solid ${color ?? "#30455B"}`,
        boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
      }}
    >
      <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: "1.9rem", fontWeight: 800, color: color ?? "var(--text)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

export default function RegistroParticipantesPage() {
  const { t } = useI18n();
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<"form" | "table">("form");
  const [externalEditingId, setExternalEditingId] = useState<string | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [photoResult, setPhotoResult] = useState<{ matched: number; notFound: number; names: string[] } | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Athlete[]>("/athletes"),
      apiFetch<Delegation[]>("/delegations"),
    ]).then(([athletesData, delegationsData]) => {
      setAthletes(athletesData ?? []);
      setDelegations(delegationsData ?? []);
    }).catch(() => {});
  }, [refreshKey]);

  const total = athletes.length;
  const validated = athletes.filter(
    (a) => a.accreditationStatus && a.accreditationStatus !== "PENDING"
  ).length;
  const pending = total - validated;
  const totalDelegations = delegations.length;
  const delegationsWithAthletes = new Set(athletes.map((a) => a.delegationId).filter(Boolean)).size;

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label={t("Total Participantes")} value={total} color="#30455B" />
        <KpiCard label={t("Validados")} value={validated} color="#21D0B3" />
        <KpiCard label={t("Pendientes")} value={pending} color="#f59e0b" />
        <KpiCard label={t("Delegaciones activas")} value={`${delegationsWithAthletes} / ${totalDelegations}`} color="#1FCDFF" />
      </div>

      <BulkImportPanel
        type="athletes"
        athleteMode="registration"
        onImported={() => setRefreshKey((current) => current + 1)}
      />

      {/* Bulk photo upload */}
      <section className="surface" style={{ borderRadius: "14px", padding: "16px 20px", borderTop: "2px solid #a78bfa", boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#a78bfa", marginBottom: "4px" }}>
              {t("Carga masiva de fotos")}
            </p>
            <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
              {t("El nombre del archivo debe coincidir con el nombre completo del participante.")}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", padding: "4px 10px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              {athletes.length} participantes
            </span>
            <label style={{
              display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 18px", borderRadius: "12px",
              background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", fontSize: "13px", fontWeight: 700,
              cursor: "pointer", boxShadow: "0 2px 10px rgba(167,139,250,0.35)", transition: "opacity 0.15s",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Seleccionar fotos
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  let matched = 0;
                  let notFound = 0;
                  const notFoundNames: string[] = [];
                  for (const file of files) {
                    const rawName = file.name.replace(/\.[^.]+$/, "").trim();
                    const baseName = rawName.toLowerCase().replace(/[._-]/g, " ");
                    const baseClean = rawName.replace(/[.\-\s]/g, "").toLowerCase();
                    const athlete = athletes.find(a => {
                      const name = (a.fullName || "").toLowerCase();
                      const id = (a.id || "").toLowerCase();
                      const passport = (a.passportNumber || "").replace(/[.\-\s]/g, "").toLowerCase();
                      return name === baseName || id.startsWith(baseName) || (passport && passport === baseClean);
                    });
                    if (!athlete) { notFound++; notFoundNames.push(file.name); continue; }
                    try {
                      const reader = new FileReader();
                      const dataUrl = await new Promise<string>((resolve) => { reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); });
                      await apiFetch(`/athletes/${athlete.id}/photo`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dataUrl }),
                      });
                      matched++;
                    } catch { notFound++; notFoundNames.push(file.name); }
                  }
                  setPhotoResult({ matched, notFound, names: notFoundNames });
                  setRefreshKey(k => k + 1);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </section>

      <section
        className="surface"
        style={{ borderRadius: "14px", padding: "14px 16px", borderTop: "2px solid #21D0B3", boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}
      >
        <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "10px" }}>
          {t("Gestión de registros")}
        </p>
        <div className="flex gap-2">
          <button
            className={`btn ${tab === "form" ? "btn-primary" : "btn-ghost"}`}
            type="button"
            onClick={() => setTab("form")}
          >
            {t("Registrar / Editar")}
          </button>
          <button
            className={`btn ${tab === "table" ? "btn-primary" : "btn-ghost"}`}
            type="button"
            onClick={() => setTab("table")}
          >
            {t("Registros y validación")}
          </button>
        </div>
      </section>

      <ResourceScreen
        config={resources.athletes}
        refreshKey={refreshKey}
        viewMode={tab}
        athleteScope="all"
        externalEditingId={externalEditingId}
        onEditRequested={(id) => {
          setExternalEditingId(id);
          setTab("form");
        }}
        onEditCancelled={() => setExternalEditingId(null)}
        onDataChanged={() => setRefreshKey((current) => current + 1)}
      />

      {/* Photo upload result modal */}
      {photoResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div style={{ background: "#fff", borderRadius: "20px", width: "100%", maxWidth: "400px", padding: "28px", boxShadow: "0 8px 40px rgba(15,23,42,0.2)", textAlign: "center" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: photoResult.matched > 0 ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              {photoResult.matched > 0 ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              )}
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
              {photoResult.matched > 0 ? "Carga completada" : "Sin coincidencias"}
            </h3>
            <div style={{ display: "flex", justifyContent: "center", gap: "16px", margin: "12px 0 16px" }}>
              <div style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <p style={{ fontSize: "20px", fontWeight: 800, color: "#10b981", margin: 0 }}>{photoResult.matched}</p>
                <p style={{ fontSize: "10px", fontWeight: 600, color: "#065f46", margin: 0 }}>Exitosas</p>
              </div>
              <div style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <p style={{ fontSize: "20px", fontWeight: 800, color: "#ef4444", margin: 0 }}>{photoResult.notFound}</p>
                <p style={{ fontSize: "10px", fontWeight: 600, color: "#991b1b", margin: 0 }}>Sin match</p>
              </div>
            </div>
            {photoResult.names.length > 0 && (
              <div style={{ textAlign: "left", background: "#f8fafc", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", maxHeight: "120px", overflowY: "auto" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px" }}>Archivos sin coincidencia</p>
                {photoResult.names.slice(0, 10).map(name => (
                  <p key={name} style={{ fontSize: "12px", color: "#64748b", margin: "2px 0" }}>{name}</p>
                ))}
                {photoResult.names.length > 10 && (
                  <p style={{ fontSize: "11px", color: "#94a3b8", margin: "4px 0 0" }}>+{photoResult.names.length - 10} más...</p>
                )}
              </div>
            )}
            <button onClick={() => setPhotoResult(null)}
              style={{ padding: "10px 32px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(33,208,179,0.3)" }}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
