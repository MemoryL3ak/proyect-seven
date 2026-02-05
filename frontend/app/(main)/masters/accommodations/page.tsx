import ResourceScreen from "@/components/ResourceScreen";
import BulkImportPanel from "@/components/BulkImportPanel";
import { resources } from "@/lib/resources";

export default function AccommodationsPage() {
  return (
    <div className="space-y-6">
      <BulkImportPanel type="hospitality" />
      <ResourceScreen config={resources.accommodations} />
    </div>
  );
}