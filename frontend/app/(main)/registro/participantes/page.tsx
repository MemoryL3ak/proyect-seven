import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";

export default function RegistroParticipantesPage() {
  return <ResourceScreen config={resources.athletes} />;
}
