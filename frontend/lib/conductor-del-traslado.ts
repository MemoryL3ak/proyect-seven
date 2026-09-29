/**
 * Conductor de los traslados de un vuelo y filtros de los monitores de
 * Llegadas y Salidas (28-09-2026, pedido de Ariel: "crear filtros en ambos
 * vuelos, y que nos aparezca en cada vuelo la información del conductor").
 *
 * El conductor sale del traslado (el que dejó AND o despacho en Viajes); su
 * teléfono y patente, de su ficha. La patente del viaje (vehículo asignado o
 * la que trajo la plantilla de AND) manda sobre la de su ficha.
 */
import { vehiculoDe } from "@/lib/directorio-conductores";
import { resumenTraslados, type TrasladoMarcable } from "@/lib/marcar-traslado";
import { claveDiaEvento } from "@/lib/hora-evento";
import { nombrePropio } from "@/lib/nombres";

export type FichaConductor = {
  id: string;
  fullName?: string | null;
  phone?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ViajeConConductor = {
  driverId?: string | null;
  vehiclePlate?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DatosConductor = { id: string; nombre: string; telefono: string; patente: string };

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function conductorDelViaje(
  viaje: ViajeConConductor | null | undefined,
  conductores: Map<string, FichaConductor>,
): DatosConductor | null {
  if (!viaje?.driverId) return null;
  const ficha = conductores.get(viaje.driverId);
  const patente =
    texto(viaje.vehiclePlate) || texto(viaje.metadata?.andPatente) || vehiculoDe(ficha?.metadata).patente || "";
  return {
    id: viaje.driverId,
    nombre: ficha?.fullName ? nombrePropio(ficha.fullName) : "Conductor asignado",
    telefono: texto(ficha?.phone),
    patente: patente.toUpperCase(),
  };
}

/** Los conductores de los traslados de un vuelo, sin repetir. */
export function conductoresDeViajes(
  viajes: ViajeConConductor[],
  conductores: Map<string, FichaConductor>,
): DatosConductor[] {
  const vistos = new Set<string>();
  const lista: DatosConductor[] = [];
  for (const viaje of viajes) {
    const datos = conductorDelViaje(viaje, conductores);
    if (!datos || vistos.has(datos.id)) continue;
    vistos.add(datos.id);
    lista.push(datos);
  }
  return lista;
}

/** Valor del filtro de conductor para los vuelos con traslado sin asignar. */
export const SIN_CONDUCTOR = "__sin_conductor__";

/** ¿Pasa el filtro de conductor? "" = todos. */
export function cumpleFiltroConductor(viajes: ViajeConConductor[], filtro: string): boolean {
  if (!filtro) return true;
  if (filtro === SIN_CONDUCTOR) return viajes.length > 0 && viajes.some((v) => !v.driverId);
  return viajes.some((v) => v.driverId === filtro);
}

export type FiltroTraslado = "" | "PENDIENTE" | "EN_CURSO" | "REALIZADO" | "SIN_TRASLADO";

export const OPCIONES_FILTRO_TRASLADO: Array<{ value: FiltroTraslado; label: string }> = [
  { value: "", label: "Traslado: todos" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "EN_CURSO", label: "En curso" },
  { value: "REALIZADO", label: "Realizado" },
  { value: "SIN_TRASLADO", label: "Sin traslado" },
];

/** ¿Pasa el filtro de estado del traslado? Uno a medias cuenta como pendiente. */
export function cumpleFiltroTraslado(viajes: Array<Pick<TrasladoMarcable, "status">>, filtro: FiltroTraslado): boolean {
  if (!filtro) return true;
  const { estado } = resumenTraslados(viajes);
  if (filtro === "PENDIENTE") return estado === "PENDIENTE" || estado === "PARCIAL";
  return estado === filtro;
}

/** Días con vuelos (del evento, no UTC) y cuántos tiene cada uno, en orden. */
export function diasConVuelos(horas: Array<string | null | undefined>): Array<{ dia: string; cantidad: number }> {
  const cuenta = new Map<string, number>();
  for (const hora of horas) {
    const dia = claveDiaEvento(hora ?? null);
    if (!dia) continue;
    cuenta.set(dia, (cuenta.get(dia) ?? 0) + 1);
  }
  return [...cuenta.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([dia, cantidad]) => ({ dia, cantidad }));
}

/** Opciones de conductor para el filtro: los de los traslados a la vista. */
export function opcionesFiltroConductor(
  viajes: ViajeConConductor[],
  conductores: Map<string, FichaConductor>,
): { opciones: DatosConductor[]; haySinConductor: boolean } {
  const opciones = conductoresDeViajes(viajes, conductores).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { opciones, haySinConductor: viajes.some((v) => !v.driverId) };
}
