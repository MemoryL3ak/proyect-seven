/**
 * Reserva T1/VIP desde el panel (Operaciones → Solicitudes, 28-09-2026:
 * "faltan acciones para reservar"). Hasta ahora las solicitudes llegaban sólo
 * desde la app del pasajero; operaciones no podía reservar por quien llama o
 * escribe. Arma el mismo viaje que crea la app (portal/vehicle-request): con
 * conductor queda Agendada; sin él, Pendiente, para asignarlo después.
 */
import { normalizeClientType } from "@/lib/clientTypes";

export type LugarReserva = { tipo: "HOTEL" | "SEDE" | "DIRECCION"; id?: string | null; nombre: string };

export type DatosReserva = {
  eventoId: string;
  solicitante: { id: string; userType?: string | null; fullName?: string | null } | null;
  origen: LugarReserva | null;
  destino: LugarReserva | null;
  /** "YYYY-MM-DDTHH:mm" del campo del formulario (hora de Chile). */
  fechaHora: string;
  pasajeros: number;
  vehiculo: string;
  idaYVuelta: boolean;
  regreso?: string;
  notas?: string;
  conductorId?: string | null;
  /** Quién reserva, para la bitácora del viaje. */
  autor: string;
};

/** Primer problema del formulario, o null si se puede reservar. */
export function errorDeReserva(d: DatosReserva): string | null {
  if (!d.eventoId) return "Elige el evento arriba.";
  if (!d.solicitante) return "Elige para quién es la reserva.";
  const tipo = normalizeClientType(d.solicitante.userType);
  if (tipo !== "T1" && tipo !== "VIP") return "Las reservas son para T1 o VIP.";
  if (!d.origen?.nombre.trim()) return "Indica el origen.";
  if (!d.destino?.nombre.trim()) return "Indica el destino.";
  if (!d.fechaHora || Number.isNaN(new Date(d.fechaHora).getTime())) return "Indica la fecha y hora.";
  if (!Number.isFinite(d.pasajeros) || d.pasajeros < 1) return "Indica cuántas personas viajan.";
  if (d.idaYVuelta) {
    if (!d.regreso || Number.isNaN(new Date(d.regreso).getTime())) return "Indica la fecha y hora del regreso.";
    if (new Date(d.regreso).getTime() <= new Date(d.fechaHora).getTime()) return "El regreso tiene que ser después de la ida.";
  }
  return null;
}

const campoLugar = (lugar: LugarReserva, prefijo: "origin" | "destination") => {
  if (!lugar.id) return {};
  if (lugar.tipo === "HOTEL") return { [`${prefijo}HotelId`]: lugar.id };
  if (lugar.tipo === "SEDE") return { [`${prefijo}VenueId`]: lugar.id };
  return {};
};

/** Cuerpo de POST /trips, igual al de la solicitud de la app. */
export function cuerpoReserva(d: DatosReserva, ahora: Date): Record<string, unknown> {
  const origen = d.origen!;
  const destino = d.destino!;
  const cuando = ahora.toISOString();
  return {
    eventId: d.eventoId,
    requesterAthleteId: d.solicitante!.id,
    athleteIds: [d.solicitante!.id],
    tripType: d.idaYVuelta ? "VIAJE_IDA_REGRESO" : "VIAJE_IDA",
    clientType: normalizeClientType(d.solicitante!.userType),
    requestedVehicleType: d.vehiculo || undefined,
    passengerCount: d.pasajeros,
    origin: origen.nombre.trim(),
    ...campoLugar(origen, "origin"),
    destination: destino.nombre.trim(),
    ...campoLugar(destino, "destination"),
    status: d.conductorId ? "SCHEDULED" : "REQUESTED",
    ...(d.conductorId ? { driverId: d.conductorId } : {}),
    requestedAt: cuando,
    scheduledAt: new Date(d.fechaHora).toISOString(),
    notes: d.notas?.trim() ? `[Panel] ${d.notas.trim()}` : "[Panel] Reserva desde Solicitudes",
    metadata: { log: [{ action: "CREATED", by: d.autor || "Panel", at: cuando, detail: "Reserva desde el panel" }] },
    isRoundTrip: d.idaYVuelta,
    ...(d.idaYVuelta
      ? {
          returnScheduledAt: new Date(d.regreso!).toISOString(),
          returnOrigin: destino.nombre.trim(),
          returnDestination: origen.nombre.trim(),
          ...(origen.tipo === "SEDE" && origen.id ? { returnDestinationVenueId: origen.id } : {}),
        }
      : {}),
  };
}
