"use client";

import { useState } from "react";
import ResourceScreen from "@/components/ResourceScreen";
import BulkImportPanel from "@/components/BulkImportPanel";
import { resources } from "@/lib/resources";

export default function OperacionAndPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <BulkImportPanel
        type="athletes"
        athleteMode="and"
        onImported={() => setRefreshKey((k) => k + 1)}
      />

      <ResourceScreen key={refreshKey} config={resources.delegations} />
    </div>
  );
}
