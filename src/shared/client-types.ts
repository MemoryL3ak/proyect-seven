/**
 * Catálogo canónico de tipos de cliente/participante.
 *
 * Es el mismo vocabulario que usa el frontend en `frontend/lib/clientTypes.ts`;
 * ambos deben mantenerse alineados. El campo se guarda en
 * `core.athletes.user_type` y se muestra como "Tipo de cliente".
 */
export const CLIENT_TYPES = [
  'VIP',
  'T1',
  'FAMILIA_PARAPAN',
  'TA',
  'TF',
  'TM',
  'COMITE_ORGANIZADOR',
  'PROVEEDORES',
] as const;

export type ClientType = (typeof CLIENT_TYPES)[number];

/**
 * Vocabularios antiguos que aún viven en datos ya cargados. El módulo de
 * beneficios, por ejemplo, publicaba cupones a ATHLETE/STAFF/DELEGATION_LEAD,
 * valores que ningún participante tiene, de modo que los deportistas (TA)
 * no veían ningún beneficio.
 */
const LEGACY_MAP: Record<string, string> = {
  ATHLETE: 'TA',
  ATLETA: 'TA',
  DEPORTISTA: 'TA',
  COACH: 'TF',
  STAFF: 'COMITE_ORGANIZADOR',
  DELEGATION: 'TF',
  DELEGATION_LEAD: 'TF',
  OTHER: 'VIP',
  PROVIDER: 'PROVEEDORES',
};

/** Lleva cualquier variante conocida al valor canónico. */
export function normalizeClientType(value?: string | null): string {
  const cleaned = String(value ?? '').trim().toUpperCase();
  if (!cleaned) return 'SIN_TIPO';
  return LEGACY_MAP[cleaned] ?? cleaned;
}

/** Normaliza una audiencia completa, sin duplicados ni valores vacíos. */
export function normalizeAudience(value?: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    const norm = normalizeClientType(String(item));
    if (norm && norm !== 'SIN_TIPO') out.add(norm);
  }
  return [...out];
}
