"use client";

import { useState } from "react";
import BulkImportPanel from "@/components/BulkImportPanel";
import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";

export default function DelegationsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <BulkImportPanel
        type="athletes"
        athleteMode="and"
        onImported={() => setRefreshKey((current) => current + 1)}
      />
      <ResourceScreen config={resources.delegations} refreshKey={refreshKey} />
    </div>
  );
}
