export const CLIENT_TYPE_OPTIONS = [
  { label: "VIP", value: "VIP" },
  { label: "Familia Parapan", value: "FAMILIA_PARAPAN" },
  { label: "TA (Deportista)", value: "TA" },
  { label: "TF (Oficiales Técnicos)", value: "TF" },
  { label: "TM (Prensa)", value: "TM" },
  { label: "Comité Organizador", value: "COMITE_ORGANIZADOR" },
  { label: "Proveedores", value: "PROVEEDORES" }
] as const;

const LEGACY_CLIENT_TYPE_MAP: Record<string, string> = {
  ATHLETE: "TA",
  COACH: "TF",
  STAFF: "COMITE_ORGANIZADOR",
  DELEGATION: "TF",
  OTHER: "VIP",
  PROVIDER: "PROVEEDORES"
};

export function normalizeClientType(value?: string | null) {
  const cleaned = String(value || "").trim().toUpperCase();
  if (!cleaned) return "SIN_TIPO";
  return LEGACY_CLIENT_TYPE_MAP[cleaned] || cleaned;
}

export function clientTypeLabel(value?: string | null) {
  const normalized = normalizeClientType(value);
  return (
    CLIENT_TYPE_OPTIONS.find((item) => item.value === normalized)?.label ||
    normalized
  );
}
