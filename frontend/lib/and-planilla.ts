/**
 * Columnas del traslado en la planilla de AND (botón "Descargar"), pedidas
 * por Ariel el 28-09-2026: la planilla no traía el conductor, su teléfono,
 * la patente ni el tipo de flota de cada tramo.
 *
 * Cada dato sale primero del traslado de AND (el conductor y la flota que
 * dejó despacho en Viajes) y, si falta, de la ficha: el conductor elegido en
 * AND y el vehículo registrado en su ficha de proveedor.
 */
import { vehiculoDe } from "@/lib/directorio-conductores";
import { TIPO_VEHICULO } from "@/lib/export-conductores";
import { nombrePropio } from "@/lib/nombres";
import { aplanarTramos } from "@/lib/tramos-traslado";

export type SentidoAnd = "LLEGADA" | "SALIDA";

export type ViajeAnd = {
  id: string;
  driverId?: string | null;
  vehicleId?: string | null;
  requestedVehicleType?: string | null;
  metadata?: Record<string, unknown> | null;
  childTrips?: ViajeAnd[] | null;
};

export type ConductorAnd = { id: string; fullName?: string | null; phone?: string | null; metadata?: Record<string, unknown> | null };
export type VehiculoAnd = { id: string; plate?: string | null; type?: string | null };

export type DatosTramo = { conductor: string; telefono: string; patente: string; flota: string };

/** Traslados de AND por su clave ("and:<ficha>:LLEGADA"), con los regresos desplegados. */
export function trasladosPorClave(viajes: ViajeAnd[]): Map<string, ViajeAnd> {
  const mapa = new Map<string, ViajeAnd>();
  for (const v of aplanarTramos(viajes)) {
    const clave = typeof v.metadata?.andKey === "string" ? v.metadata.andKey : "";
    if (clave && !mapa.has(clave)) mapa.set(clave, v);
  }
  return mapa;
}

const textoMeta = (valor: unknown) => (typeof valor === "string" ? valor : "");

const flotaLegible = (valor?: string | null) => {
  const crudo = String(valor ?? "").trim();
  return crudo ? TIPO_VEHICULO[crudo.toUpperCase()] ?? crudo : "";
};

export function datosDelTramo(
  fichaId: string,
  sentido: SentidoAnd,
  conductorDeLaFicha: string | null | undefined,
  traslados: Map<string, ViajeAnd>,
  conductores: Map<string, ConductorAnd>,
  vehiculos: Map<string, VehiculoAnd>,
): DatosTramo {
  const viaje = traslados.get(`and:${fichaId}:${sentido}`);
  const driverId = viaje?.driverId || conductorDeLaFicha || null;
  const conductor = driverId ? conductores.get(driverId) : undefined;
  const suVehiculo = vehiculoDe(conductor?.metadata);
  const delViaje = viaje?.vehicleId ? vehiculos.get(viaje.vehicleId) : undefined;
  const flotaDelViaje = flotaLegible(viaje?.requestedVehicleType) || flotaLegible(delViaje?.type);
  return {
    conductor: conductor?.fullName ? nombrePropio(conductor.fullName) : "",
    telefono: String(conductor?.phone ?? "").trim(),
    // Vehículo asignado en Viajes, luego la patente de la plantilla de AND y
    // al final la del vehículo registrado del conductor.
    patente: String(delViaje?.plate || textoMeta(viaje?.metadata?.andPatente) || suVehiculo.patente || "")
      .trim()
      .toUpperCase(),
    flota: flotaDelViaje || suVehiculo.tipo || "",
  };
}

/** "2026-09-28T14:15" (campo del formulario) → "28-09-2026 14:15". */
export function fechaHoraPlanilla(valor?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(valor ?? ""));
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}` : "";
}
