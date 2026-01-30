import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";

export default function FlightsPage() {
  return <ResourceScreen config={resources.flights} />;
}
