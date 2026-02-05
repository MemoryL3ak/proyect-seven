import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";

export default function DelegationsPage() {
  return <ResourceScreen config={resources.delegations} />;
}
