import ResourceScreen from "@/components/ResourceScreen";
import { resources } from "@/lib/resources";

export default function SedePage() {
  return <ResourceScreen config={resources.venues} />;
}
