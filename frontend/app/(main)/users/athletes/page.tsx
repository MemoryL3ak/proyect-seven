import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";

export default function AthletesPage() {
  return <ResourceScreen config={resources.athletes} />;
}
