import { describe, expect, it } from "vitest";
import {
  conductorDelViaje,
  conductoresDeViajes,
  cumpleFiltroConductor,
  cumpleFiltroTraslado,
  diasConVuelos,
  SIN_CONDUCTOR,
} from "./conductor-del-traslado";

/**
 * 28-09-2026: "crear filtros en ambos vuelos, y que nos aparezca en cada
 * vuelo la información del conductor". Datos reales: Carlos (SUV, TRSB84)
 * llevó a Sergio Alvarenga; Luis Soto tiene traslados de AND sin patente.
 */
const conductores = new Map([
  ["carlos", { id: "carlos", fullName: "Carlos marcelo Hernández sepulveda", phone: "+56998241782", metadata: { vehiclePatente: "trsb84" } }],
  ["luis", { id: "luis", fullName: "LUIS SOTO", phone: "+56 9 5555 1111", metadata: {} }],
]);

describe("conductor del traslado en los monitores de vuelos", () => {
  it("trae nombre, teléfono y patente de su ficha", () => {
    expect(conductorDelViaje({ driverId: "carlos" }, conductores)).toEqual({
      id: "carlos",
      nombre: "Carlos Marcelo Hernández Sepulveda",
      telefono: "+56998241782",
      patente: "TRSB84",
    });
  });

  it("la patente del viaje (Viajes o plantilla de AND) manda sobre la de la ficha", () => {
    expect(conductorDelViaje({ driverId: "carlos", metadata: { andPatente: "zzxx11" } }, conductores)?.patente).toBe("ZZXX11");
    expect(conductorDelViaje({ driverId: "carlos", vehiclePlate: "abcd12" }, conductores)?.patente).toBe("ABCD12");
  });

  it("sin conductor asignado no hay datos; varios traslados, sin repetir", () => {
    expect(conductorDelViaje({ driverId: null }, conductores)).toBeNull();
    const lista = conductoresDeViajes([{ driverId: "luis" }, { driverId: "carlos" }, { driverId: "luis" }, {}], conductores);
    expect(lista.map((c) => c.id)).toEqual(["luis", "carlos"]);
  });

  it("filtro de conductor: el suyo, o los que tienen un traslado sin asignar", () => {
    const vuelo = [{ driverId: "luis" }, { driverId: null }];
    expect(cumpleFiltroConductor(vuelo, "luis")).toBe(true);
    expect(cumpleFiltroConductor(vuelo, "carlos")).toBe(false);
    expect(cumpleFiltroConductor(vuelo, SIN_CONDUCTOR)).toBe(true);
    expect(cumpleFiltroConductor([], SIN_CONDUCTOR)).toBe(false);
    expect(cumpleFiltroConductor([], "")).toBe(true);
  });

  it("filtro de traslado por estado", () => {
    expect(cumpleFiltroTraslado([{ status: "SCHEDULED" }], "PENDIENTE")).toBe(true);
    expect(cumpleFiltroTraslado([{ status: "COMPLETED" }, { status: "SCHEDULED" }], "PENDIENTE")).toBe(true);
    expect(cumpleFiltroTraslado([{ status: "COMPLETED" }], "REALIZADO")).toBe(true);
    expect(cumpleFiltroTraslado([{ status: "EN_ROUTE" }], "EN_CURSO")).toBe(true);
    expect(cumpleFiltroTraslado([], "SIN_TRASLADO")).toBe(true);
    expect(cumpleFiltroTraslado([{ status: "SCHEDULED" }], "REALIZADO")).toBe(false);
  });

  it("los días van en hora de Chile: un vuelo de las 21:50 del 27 es del 27", () => {
    expect(diasConVuelos(["2026-09-28T00:50:00.000Z", "2026-09-29T05:00:00.000Z", "2026-09-29T12:00:00.000Z", null])).toEqual([
      { dia: "2026-09-27", cantidad: 1 },
      { dia: "2026-09-29", cantidad: 2 },
    ]);
  });
});
