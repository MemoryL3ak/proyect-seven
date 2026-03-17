"use client";

import { useState } from "react";
import BulkImportPanel from "@/components/BulkImportPanel";
import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";

export default function RegistroParticipantesPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<"form" | "table">("form");
  const [externalEditingId, setExternalEditingId] = useState<string | null>(null);

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <BulkImportPanel
        type="athletes"
        athleteMode="registration"
        onImported={() => setRefreshKey((current) => current + 1)}
      />

      <section className="surface rounded-2xl p-3">
        <div className="flex gap-2">
          <button
            className={`btn ${tab === "form" ? "btn-primary" : "btn-ghost"}`}
            type="button"
            onClick={() => setTab("form")}
          >
            Registrar / Editar
          </button>
          <button
            className={`btn ${tab === "table" ? "btn-primary" : "btn-ghost"}`}
            type="button"
            onClick={() => setTab("table")}
          >
            Registros y validación
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
