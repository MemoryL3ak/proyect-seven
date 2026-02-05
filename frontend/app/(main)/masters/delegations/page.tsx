import ResourceScreen from "@/components/ResourceScreen";
import BulkImportPanel from "@/components/BulkImportPanel";
import { resources } from "@/lib/resources";

export default function DelegationsPage() {
  return (
    <div className="space-y-6">
      <BulkImportPanel type="athletes" />
      <ResourceScreen config={resources.delegations} />
    </div>
  );
}