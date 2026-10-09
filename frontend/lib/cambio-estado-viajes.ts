/**
 * "Cambiar estado" en la barra de selección múltiple de Viajes (09-10-2026):
 * los estados ofrecidos y los textos de confirmación y resultado.
 */
import { TRIP_STATUS_META } from "./design";

export const OPCIONES_CAMBIO_ESTADO = ["SCHEDULED", "EN_ROUTE", "PICKED_UP", "COMPLETED", "CANCELLED"] as const;
export type EstadoCambio = (typeof OPCIONES_CAMBIO_ESTADO)[number];

export function etiquetaEstado(status: string): string {
  return TRIP_STATUS_META[status]?.label ?? status;
}

export function esEstadoCambio(valor: string): valor is EstadoCambio {
  return (OPCIONES_CAMBIO_ESTADO as readonly string[]).includes(valor);
}

const viajes = (n: number) => `${n} viaje${n === 1 ? "" : "s"}`;

export function mensajeConfirmarCambio(n: number, status: EstadoCambio): { titulo: string; mensaje: string } {
  const a = etiquetaEstado(status);
  return {
    titulo: `Cambiar ${viajes(n)} a "${a}"`,
    mensaje:
      status === "CANCELLED"
        ? `Los ${viajes(n)} seleccionados quedarán cancelados. El conductor y los pasajeros dejan de verlos como pendientes. ¿Cancelar?`
        : `Los ${viajes(n)} seleccionados pasarán a "${a}", con la hora de este cambio como inicio o cierre cuando corresponda, y quedará registrado en la bitácora de cada viaje. ¿Cambiar?`,
  };
}

export function mensajeResultadoCambio(r: { requestedCount: number; updatedCount: number; errores: { id: string; mensaje: string }[] }, status: EstadoCambio): string {
  const base = `${viajes(r.updatedCount)} ahora en "${etiquetaEstado(status)}".`;
  if (r.errores.length === 0) return base;
  return `${base} ${r.errores.length} no se pudo${r.errores.length === 1 ? "" : "ieron"} cambiar: ${r.errores[0].mensaje}`;
}
