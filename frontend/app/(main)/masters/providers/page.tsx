import { resources } from "@/lib/resources";
import ResourceScreen from "@/components/ResourceScreen";

export default function ProvidersPage() {
  return <ResourceScreen config={resources.providers} />;
}
