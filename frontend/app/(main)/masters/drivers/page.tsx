import BulkImportPanel from "@/components/BulkImportPanel";
import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";

export default function DriversPage() {
  return (
    <div className="space-y-6">
      <BulkImportPanel type="drivers" />
      <ResourceScreen config={resources.drivers} />
    </div>
  );
}
