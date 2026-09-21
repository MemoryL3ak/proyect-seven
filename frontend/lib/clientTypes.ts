export const CLIENT_TYPE_OPTIONS = [
  { label: "VIP", value: "VIP" },
  { label: "T1", value: "T1" },
  { label: "Familia Parapan", value: "FAMILIA_PARAPAN" },
  { label: "TA (Deportista)", value: "TA" },
  { label: "TF (Oficiales Técnicos)", value: "TF" },
  { label: "TM (Prensa)", value: "TM" },
  { label: "Jefe de Misión", value: "JEFE_MISION" },
  { label: "Coordinador Comité", value: "COORDINADOR_COMITE" },
  // Coordinador Transporte: los mismos módulos del Coordinador Comité y, de
  // más, el contacto con el conductor de cada traslado.
  { label: "Coordinador Transporte", value: "COORDINADOR_TRANSPORTE" },
  // Responsable de un recinto. Se asigna a la sede desde el maestro de Sedes,
  // que sale a buscar justamente a los participantes con este rol.
  { label: "Coordinador de Sede", value: "COORDINADOR_SEDE" },
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

/**
 * Los dos coordinadores que miran el evento entero, no una región: Comité y
 * Transporte. Comparten los módulos del portal (actividades, calendario,
 * sedes, hoteles, alimentación, documentos) y la misma ficha en el panel, sin
 * delegación ni deporte que los acote.
 */
export function isEventCoordinator(value?: string | null) {
  const tipo = normalizeClientType(value);
  return tipo === "COORDINADOR_COMITE" || tipo === "COORDINADOR_TRANSPORTE";
}

/**
 * Quién puede escribirle directo al chofer. Para el resto del portal el
 * contacto es el Coordinador General —decisión de producto: al conductor no
 * lo llama cualquiera—, y el Coordinador Transporte es la excepción, porque
 * hablar con ellos es justamente su trabajo. El Jefe de Misión tiene lo suyo
 * aparte, en el módulo Flota de su región.
 */
export function canContactDrivers(value?: string | null) {
  return normalizeClientType(value) === "COORDINADOR_TRANSPORTE";
}
