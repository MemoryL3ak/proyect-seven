/**
 * Lo poco que hay que recordar del usuario entre una apertura y la siguiente:
 * si es jefe de misión y a qué delegación pertenece.
 *
 * Sin esto, la app tenía que esperar la ficha del participante para recién
 * empezar a pedir los viajes y la nómina de su delegación: una ida y vuelta
 * entera al servidor antes de la siguiente. Con el dato guardado, esas
 * peticiones salen junto con la ficha. Si resultara equivocado (cambió de
 * delegación, dejó de ser jefe), la ficha manda y se vuelve a pedir.
 */
const CLAVE = "seven.portal.perfil";

export type PerfilRecordado = {
  id: string;
  esJefe: boolean;
  delegationId: string | null;
};

export function leerPerfil(id: string): PerfilRecordado | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const perfil = JSON.parse(crudo) as PerfilRecordado;
    if (!perfil || perfil.id !== id) return null;
    return perfil;
  } catch {
    return null;
  }
}

export function guardarPerfil(perfil: PerfilRecordado): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(perfil));
  } catch {
    // Sin permiso para escribir: la app funciona igual, sólo sin el atajo.
  }
}

export function olvidarPerfil(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {}
}
