/**
 * Tipo de flota del conductor en el viaje manual (28-09-2026: "al registrar
 * el viaje manual no me toma los tipos de flota por conductor"). Con "SUV"
 * elegido, el desplegable de conductor ofrecía también a los de Bus y Van:
 * sólo se miraba la capacidad, y un conductor sin capacidad cargada pasaba
 * siempre. Tampoco se acotaba al evento: en Rugby salían los de Viña.
 */
import { conductorEnEvento } from "@/lib/conductores-del-evento";

export const TIPOS_FLOTA = ["SEDAN", "SUV", "VAN_10", "VAN_15", "VAN_19", "MINIBUS", "BUS"] as const;

const plano = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const ALIAS: Record<string, string> = {
  AUTO: "SEDAN",
  SEDAN: "SEDAN",
  CAMIONETA: "SUV",
  VAN_15_17: "VAN_15",
  VAN_15_16: "VAN_15",
  MINI_BUS: "MINIBUS",
  MICRO: "MINIBUS",
  M4: "BUS",
  BUS_40_PAX: "BUS",
};

/** Código de flota ("Van 15-17" → "VAN_15"); null si no se reconoce. */
export function tipoFlota(valor: unknown): string | null {
  const v = plano(valor);
  if (!v) return null;
  if ((TIPOS_FLOTA as readonly string[]).includes(v)) return v;
  return ALIAS[v] ?? null;
}

export type OpcionConductor = {
  value: string;
  label: string;
  capacity?: number | null;
  vehicleType?: string | null;
  eventIds?: string[] | null;
  eventId?: string | null;
};

/**
 * Conductores para el viaje: los del evento, del tipo de flota pedido y con
 * cupo para los pasajeros. El ya elegido se conserva (al editar un viaje no
 * desaparece de la lista).
 */
export function conductoresParaViaje<T extends OpcionConductor>(
  opciones: T[],
  filtro: { eventoId?: string | null; tipo?: string | null; pasajeros?: number; elegido?: string | null },
): T[] {
  const tipo = tipoFlota(filtro.tipo);
  const pasajeros = filtro.pasajeros && filtro.pasajeros > 0 ? filtro.pasajeros : 0;
  return opciones.filter((o) => {
    if (filtro.elegido && o.value === filtro.elegido) return true;
    if (!conductorEnEvento(o, filtro.eventoId)) return false;
    if (tipo && tipoFlota(o.vehicleType) !== tipo) return false;
    if (pasajeros && o.capacity && o.capacity < pasajeros) return false;
    return true;
  });
}
