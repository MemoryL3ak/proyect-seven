import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";

export default function TripsPage() {
  return <ResourceScreen config={resources.trips} />;
}
