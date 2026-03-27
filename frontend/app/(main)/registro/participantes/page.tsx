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
  status?: string | null;
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
        onDataChanged={() => setRefreshKey((current) => current + 1)}
      />
    </div>
  );
}
