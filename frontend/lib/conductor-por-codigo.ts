/**
 * Ficha del conductor que corresponde a un código o id de portal.
 *
 * El código visible son los últimos 6 caracteres del id (o del userId). El
 * servidor ya resolvió la identidad en el login; acá sólo se ubica la ficha
 * dentro de la lista de /drivers. Si no está en la lista (30-09-2026: la
 * lista descartaba homónimos y Manuel Gonzales, código 43c32f, no aparecía),
 * el portal la pide por id en vez de decir que el código no existe.
 */
export type ConductorIdentificable = { id?: string | null; userId?: string | null };

export function coincideConductor(conductor: ConductorIdentificable, entrada: string): boolean {
  const codigo = String(entrada ?? "").trim().toLowerCase();
  if (!codigo) return false;
  const id = String(conductor.id ?? "").toLowerCase();
  const userId = String(conductor.userId ?? "").toLowerCase();
  return (
    (!!id && (codigo === id || codigo === id.slice(-6))) ||
    (!!userId && (codigo === userId || codigo === userId.slice(-6)))
  );
}

export function conductorPorCodigo<T extends ConductorIdentificable>(lista: T[], entrada: string): T | null {
  return lista.find((c) => coincideConductor(c, entrada)) ?? null;
}
