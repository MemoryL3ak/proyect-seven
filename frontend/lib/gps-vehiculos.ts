/**
 * Equipos GPS de vehículo (rastreadores OBD, GET /gps-trackers) tal como los
 * muestra Monitoreo de conductores: estado, rótulo y marcador del mapa.
 * 09-10-2026: la posición del bus deja de depender del teléfono del
 * conductor; el filtro "Fuente" del monitoreo permite ver sólo estos equipos.
 */
import type { PresenceMarker } from "@/components/DriverPresenceMap";

export type EquipoGps = {
  imei: string;
  conectado: boolean;
  conectadoDesde: string | null;
  ultimoPaquete: string | null;
  ultimaPosicion: { fecha: string; satelites: number; lat: number; lng: number; velocidad: number; rumbo: number; valido: boolean; recibida: string } | null;
  paquetes: number;
  posicionesGuardadas: number;
  vehicleId: string | null;
  vehiclePlate: string | null;
  eventId: string | null;
  label: string | null;
  conductorId: string | null;
  conductorNombre: string | null;
  tripId: string | null;
  ultimoError: string | null;
};

/** Sin paquete en 5 minutos, el equipo está sin conexión. */
export const VENTANA_EQUIPO_CONECTADO_MS = 5 * 60 * 1000;
/** Detenido reporta cada 60 s (TIMER,10,60): 3 minutos sin posición es señal perdida. */
export const VENTANA_GPS_EQUIPO_MS = 3 * 60 * 1000;

export type EstadoEquipo = {
  conectado: boolean;
  gpsVivo: boolean;
  /** Segundos desde la última posición recibida; null si nunca mandó una. */
  edadGpsS: number | null;
  edadPaqueteS: number | null;
};

const edad = (iso: string | null | undefined, ahoraMs: number): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.round((ahoraMs - t) / 1000)) : null;
};

export function estadoDeEquipo(e: EquipoGps, ahoraMs: number): EstadoEquipo {
  const edadPaqueteS = edad(e.ultimoPaquete, ahoraMs);
  const edadGpsS = edad(e.ultimaPosicion?.recibida, ahoraMs);
  return {
    conectado: edadPaqueteS != null && edadPaqueteS * 1000 < VENTANA_EQUIPO_CONECTADO_MS,
    gpsVivo: edadGpsS != null && edadGpsS * 1000 < VENTANA_GPS_EQUIPO_MS,
    edadGpsS,
    edadPaqueteS,
  };
}

/** Patente si tiene vehículo; si no, los últimos 6 del IMEI para reconocerlo. */
export function nombreEquipo(e: EquipoGps): string {
  return e.vehiclePlate?.trim() || e.label?.trim() || `GPS ·${e.imei.slice(-6)}`;
}

export function hace(segundos: number | null): string {
  if (segundos == null) return "—";
  if (segundos < 60) return `hace ${segundos}s`;
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`;
  return `hace ${Math.floor(segundos / 86400)} d`;
}

/** Marcador del mapa; null si el equipo nunca mandó una posición. */
export function marcadorDeEquipo(e: EquipoGps, ahoraMs: number): PresenceMarker | null {
  const p = e.ultimaPosicion;
  if (!p) return null;
  const estado = estadoDeEquipo(e, ahoraMs);
  const detailRows: { label: string; value: string }[] = [
    { label: "IMEI", value: e.imei },
    { label: "Vehículo", value: e.vehiclePlate ?? "sin asignar" },
    ...(e.conductorNombre ? [{ label: "Conductor", value: e.conductorNombre }] : []),
    { label: "Velocidad", value: `${Math.round(p.velocidad)} km/h` },
  ];
  return {
    id: `gps:${e.imei}`,
    lat: p.lat,
    lng: p.lng,
    name: nombreEquipo(e),
    online: estado.gpsVivo,
    conectado: estado.conectado,
    onTrip: Boolean(e.tripId) && estado.gpsVivo,
    tripLabel: e.tripId ? "En viaje" : null,
    lastSeen: hace(estado.edadPaqueteS),
    gpsTime: new Date(p.fecha).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    activeTrips: e.tripId ? 1 : 0,
    platform: "gps-vehiculo",
    clientTypes: [],
    detailRows,
  };
}
