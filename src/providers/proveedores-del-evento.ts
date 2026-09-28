import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Proveedores por evento (28-09-2026): cada proveedor guarda en event_ids
 * los eventos en que trabaja, y sus conductores (participantes marcados
 * como conductor) trabajan en esos eventos. Antes eran una sola lista para
 * todos los eventos y la auto-asignación de World Rugby habría tomado a los
 * conductores de los Juegos Escolares.
 */

/**
 * Ids de los proveedores de un evento. null = no filtrar: sin evento, o si
 * la consulta falla (mejor ofrecer todos los conductores que ninguno).
 */
export async function proveedoresDelEvento(
  supabase: SupabaseClient,
  eventId?: string | null,
): Promise<Set<string> | null> {
  if (!eventId) return null;
  const { data, error } = await supabase
    .schema('core')
    .from('providers')
    .select('id')
    .contains('event_ids', [eventId]);
  if (error) return null;
  return new Set(((data ?? []) as Array<{ id: string }>).map((r) => r.id));
}

/** ¿El conductor (por su proveedor) trabaja en el evento? */
export function esDeProveedorDelEvento(
  proveedores: Set<string> | null,
  providerId: string | null | undefined,
): boolean {
  if (!proveedores) return true;
  return !!providerId && proveedores.has(providerId);
}
