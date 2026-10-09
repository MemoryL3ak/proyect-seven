import { describe, expect, it } from "vitest";
import { estadoDeEquipo, marcadorDeEquipo, nombreEquipo, type EquipoGps } from "./gps-vehiculos";

const T = Date.parse("2026-10-09T05:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const base: EquipoGps = {
  imei: "862667088669224",
  conectado: true,
  conectadoDesde: iso(T - 600_000),
  ultimoPaquete: iso(T - 20_000),
  ultimaPosicion: { fecha: iso(T - 30_000), satelites: 9, lat: -33.4543, lng: -70.5186, velocidad: 42, rumbo: 143, valido: true, recibida: iso(T - 28_000) },
  paquetes: 12,
  posicionesGuardadas: 10,
  vehicleId: "veh-1",
  vehiclePlate: "KBGB58",
  eventId: "ev-1",
  label: null,
  conductorId: "drv-1",
  conductorNombre: "juan villegas",
  tripId: "trip-1",
  ultimoError: null,
};

describe("equipos GPS de vehículo en el monitoreo", () => {
  it("el equipo de Ariel (09-10-2026): con paquete y posición recientes está conectado y con GPS vivo", () => {
    expect(estadoDeEquipo(base, T)).toEqual({ conectado: true, gpsVivo: true, edadGpsS: 28, edadPaqueteS: 20 });
  });

  it("sin paquete en 5 minutos queda sin conexión; sin posición en 3 minutos, sin GPS", () => {
    expect(estadoDeEquipo({ ...base, ultimoPaquete: iso(T - 6 * 60_000) }, T).conectado).toBe(false);
    expect(estadoDeEquipo({ ...base, ultimaPosicion: { ...base.ultimaPosicion!, recibida: iso(T - 4 * 60_000) } }, T).gpsVivo).toBe(false);
    expect(estadoDeEquipo({ ...base, ultimaPosicion: null }, T)).toMatchObject({ gpsVivo: false, edadGpsS: null });
  });

  it("se nombra por la patente; sin vehículo, por los últimos 6 del IMEI", () => {
    expect(nombreEquipo(base)).toBe("KBGB58");
    expect(nombreEquipo({ ...base, vehiclePlate: null })).toBe("GPS ·669224");
    expect(nombreEquipo({ ...base, vehiclePlate: null, label: "Auto de Ariel" })).toBe("Auto de Ariel");
  });

  it("el marcador va en viaje sólo con viaje en curso y GPS vivo, y lleva IMEI, vehículo y conductor", () => {
    const m = marcadorDeEquipo(base, T);
    expect(m).toMatchObject({ id: "gps:862667088669224", name: "KBGB58", online: true, conectado: true, onTrip: true, platform: "gps-vehiculo", lat: -33.4543, lng: -70.5186 });
    expect(m?.detailRows?.map((r) => r.value)).toEqual(["862667088669224", "KBGB58", "juan villegas", "42 km/h"]);
    expect(marcadorDeEquipo({ ...base, tripId: null }, T)?.onTrip).toBe(false);
    expect(marcadorDeEquipo({ ...base, ultimaPosicion: null }, T)).toBeNull();
  });
});
