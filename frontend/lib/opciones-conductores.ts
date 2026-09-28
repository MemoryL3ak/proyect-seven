/**
 * Opciones de los desplegables de conductor (Viajes, AND). La pantalla junta
 * /drivers con los participantes de proveedores marcados como conductor, pero
 * /drivers ya trae a esos mismos: cada conductor de proveedor salía dos veces,
 * y en el orden de llegada, no por nombre (28-09-2026, "Conductor llegada" de
 * AND con más de 80 nombres).
 */
export type ConductorOpcion = { id?: string | null; fullName?: string | null };

export function sinConductoresRepetidos<T extends ConductorOpcion>(listas: T[][]): T[] {
  const vistos = new Set<string>();
  const resultado: T[] = [];
  for (const lista of listas) {
    for (const conductor of lista ?? []) {
      const id = conductor?.id ? String(conductor.id) : "";
      if (!id || vistos.has(id)) continue;
      vistos.add(id);
      resultado.push(conductor);
    }
  }
  return resultado;
}

export function opcionesDeConductores(conductores: ConductorOpcion[]): Array<{ label: string; value: string }> {
  return conductores
    .map((c) => ({ label: String(c.fullName ?? "").trim() || String(c.id), value: String(c.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
}
