import { describe, expect, it } from "vitest";
import { opcionesDeConductores, sinConductoresRepetidos } from "./opciones-conductores";

/**
 * 28-09-2026: en "Conductor llegada" de AND cada conductor de proveedor salía
 * dos veces (venía en /drivers y otra vez en los participantes de proveedor)
 * y sin orden.
 */
describe("sinConductoresRepetidos", () => {
  it("el conductor que viene en las dos listas queda una vez", () => {
    const drivers = [{ id: "hector", fullName: "Héctor Silva" }, { id: "flota", fullName: "Flota Propia" }];
    const participantes = [{ id: "hector", fullName: "Héctor Silva" }, { id: "ana", fullName: "Ana Díaz" }];
    expect(sinConductoresRepetidos([drivers, participantes]).map((c) => c.id)).toEqual(["hector", "flota", "ana"]);
  });
  it("sin id no entra", () => {
    expect(sinConductoresRepetidos([[{ id: null, fullName: "X" }]])).toEqual([]);
  });
});

describe("opcionesDeConductores", () => {
  it("por nombre, sin importar tildes ni mayúsculas", () => {
    const opciones = opcionesDeConductores([
      { id: "3", fullName: "patricia Contreras" },
      { id: "1", fullName: "Álvaro Pérez" },
      { id: "2", fullName: "Héctor Silva" },
    ]);
    expect(opciones.map((o) => o.label)).toEqual(["Álvaro Pérez", "Héctor Silva", "patricia Contreras"]);
    expect(opciones[0].value).toBe("1");
  });
});
