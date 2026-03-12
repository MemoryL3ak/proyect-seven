import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";

export default function OperacionAndPage() {
  return <ResourceScreen config={resources.delegations} />;
}
