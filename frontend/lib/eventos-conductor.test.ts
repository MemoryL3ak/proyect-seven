import { describe, expect, it } from "vitest";
import { enEventosDelConductor, eventosDelConductor } from "./eventos-conductor";

/** 28-09-2026: el conductor de Rugby veía las sedes y hoteles de los Juegos. */
describe("eventos del conductor", () => {
  it("los del proveedor, o el de la flota propia", () => {
    expect(eventosDelConductor({ eventIds: ["rugby"] })).toEqual(["rugby"]);
    expect(eventosDelConductor({ eventIds: [], eventId: "jde" })).toEqual(["jde"]);
    expect(eventosDelConductor(null)).toEqual([]);
  });
  it("sólo lo de sus eventos; lo general se ve siempre", () => {
    expect(enEventosDelConductor(["rugby"], "rugby")).toBe(true);
    expect(enEventosDelConductor(["rugby"], "jde")).toBe(false);
    expect(enEventosDelConductor(["rugby"], null)).toBe(true);
  });
  it("sin eventos conocidos no se esconde nada", () => {
    expect(enEventosDelConductor([], "jde")).toBe(true);
  });
});
