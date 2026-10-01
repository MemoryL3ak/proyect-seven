/**
 * Una sola lista de conductores a partir de los choferes de proveedor
 * (core.provider_participants) y la flota propia (transport.drivers).
 *
 * La misma persona puede estar en las dos fuentes: se registra en el
 * proveedor y con esa identidad entra a su portal, así que esa manda y se
 * descarta la copia de la flota, por id o por nombre.
 *
 * 30-09-2026: el descarte por nombre también se aplicaba dentro de los
 * proveedores. Alex Arévalo tenía dos "Manuel Gonzales" —uno quitado del
 * evento de Rugby y otro nuevo, con el código 43c32f— y la lista se quedaba
 * con el viejo. El login resolvía el código bien, pero la app buscaba la
 * ficha en esta lista, no la encontraba y decía "El ID ingresado no
 * corresponde a un conductor registrado". Dos personas distintas del mismo
 * proveedor nunca se descartan entre sí: sólo la flota cede ante el
 * proveedor.
 */
export type ConductorUnificable = { id?: unknown; fullName?: unknown } & Record<string, unknown>;

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

export function unificarConductores<T extends ConductorUnificable>(proveedores: T[], flota: T[]): T[] {
  const out: T[] = [];
  const idsProveedor = new Set<string>();
  const nombresProveedor = new Set<string>();
  const idsVistos = new Set<string>();

  for (const item of proveedores) {
    const id = String(item.id ?? '');
    if (id && idsVistos.has(id)) continue;
    if (id) {
      idsVistos.add(id);
      idsProveedor.add(id);
    }
    const nombre = norm(item.fullName);
    if (nombre) nombresProveedor.add(nombre);
    out.push(item);
  }

  for (const item of flota) {
    const id = String(item.id ?? '');
    if (id && idsVistos.has(id)) continue;
    // La flota cede ante el proveedor: misma persona registrada en los dos.
    if (idsProveedor.has(id) || nombresProveedor.has(norm(item.fullName))) continue;
    if (id) idsVistos.add(id);
    out.push(item);
  }
  return out;
}
