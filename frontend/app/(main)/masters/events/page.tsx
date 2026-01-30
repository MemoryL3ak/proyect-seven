import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";

export default function EventsPage() {
  return <ResourceScreen config={resources.events} />;
}
