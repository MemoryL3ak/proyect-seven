import BulkImportPanel from "@/components/BulkImportPanel";
import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";

export default function DriversPage() {
  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <BulkImportPanel type="drivers" />
      <ResourceScreen config={resources.drivers} />
    </div>
  );
}
