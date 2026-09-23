import ResourceScreen from "@/components/ResourceScreen";
import BulkImportPanel from "@/components/BulkImportPanel";
import { resources } from "@/lib/resources";

export default function AccommodationsPage() {
  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <BulkImportPanel type="hospitality" />
      <ResourceScreen config={resources.accommodations} />
    </div>
  );
}