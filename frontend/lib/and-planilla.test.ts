import { describe, expect, it } from "vitest";
import { datosDelTramo, fechaHoraPlanilla, trasladosPorClave, type ConductorAnd, type ViajeAnd } from "./and-planilla";

/**
 * 28-09-2026: la planilla de AND no traía conductor, teléfono, patente ni
 * tipo de flota. Datos reales: Carlos (SUV Mazda CX5, TRSB84) llevó a Sergio
 * Alvarenga y a Fernando Ginzo; despacho puso SUV en el traslado de Sergio.
 */
const CARLOS: ConductorAnd = {
  id: "carlos",
  fullName: "Carlos marcelo Hernández sepulveda",
  phone: "+56998241782",
  metadata: { vehiclePatente: "trsb84", vehicleTipo: "SUV", vehicleMarca: "MAZDA", vehicleModelo: "CX5" },
};
const conductores = new Map([[CARLOS.id, CARLOS]]);

const salidaSergio: ViajeAnd = { id: "out", driverId: null, metadata: { andKey: "and:sergio:SALIDA" } };
const viajes: ViajeAnd[] = [
  { id: "in", driverId: "carlos", requestedVehicleType: "SUV", metadata: { andKey: "and:sergio:LLEGADA" }, childTrips: [salidaSergio] },
  { id: "in-ginzo", driverId: "carlos", metadata: { andKey: "and:ginzo:LLEGADA" } },
];
const traslados = trasladosPorClave(viajes);

describe("planilla de AND: datos del traslado", () => {
  it("la llegada de Sergio trae conductor, teléfono, patente y flota", () => {
    expect(datosDelTramo("sergio", "LLEGADA", null, traslados, conductores, new Map())).toEqual({
      conductor: "Carlos Marcelo Hernández Sepulveda",
      telefono: "+56998241782",
      patente: "TRSB84",
      flota: "SUV",
    });
  });

  it("sin flota en el traslado, usa el vehículo del conductor", () => {
    expect(datosDelTramo("ginzo", "LLEGADA", null, traslados, conductores, new Map()).flota).toBe("SUV");
  });

  it("encuentra el regreso anidado; sin conductor queda en blanco", () => {
    expect(datosDelTramo("sergio", "SALIDA", null, traslados, conductores, new Map())).toEqual({
      conductor: "",
      telefono: "",
      patente: "",
      flota: "",
    });
  });

  it("sin traslado todavía, usa el conductor elegido en la ficha", () => {
    expect(datosDelTramo("nuevo", "LLEGADA", "carlos", traslados, conductores, new Map()).conductor).toBe(
      "Carlos Marcelo Hernández Sepulveda",
    );
  });

  it("el vehículo asignado en Viajes manda sobre el del conductor", () => {
    const conVehiculo = trasladosPorClave([{ id: "x", driverId: "carlos", vehicleId: "v1", metadata: { andKey: "and:a:LLEGADA" } }]);
    const vehiculos = new Map([["v1", { id: "v1", plate: "abcd12", type: "VAN_15" }]]);
    expect(datosDelTramo("a", "LLEGADA", null, conVehiculo, conductores, vehiculos)).toMatchObject({ patente: "ABCD12", flota: "Van 15-17" });
  });

  it("fecha y hora legibles", () => {
    expect(fechaHoraPlanilla("2026-09-28T14:15")).toBe("28-09-2026 14:15");
    expect(fechaHoraPlanilla("")).toBe("");
  });
});
