import { describe, expect, it } from "vitest";
import { conductoresParaViaje, tipoFlota } from "./flota-conductor";

/**
 * 28-09-2026: "al registrar el viaje manual no me toma los tipos de flota por
 * conductor". Con SUV elegido salían también los de Bus y Van, y los de Viña.
 */
const RUGBY = "rugby";
const JDE = "jde";
const opciones = [
  { value: "carlos", label: "Carlos Hernández · TRSB84", vehicleType: "SUV", capacity: null, eventIds: [RUGBY] },
  { value: "luis", label: "Luis Soto", vehicleType: "BUS", capacity: 46, eventIds: [RUGBY] },
  { value: "alejandro", label: "Alejandro Díaz", vehicleType: "VAN_10", capacity: 10, eventIds: [RUGBY] },
  { value: "viña", label: "Chofer de Viña", vehicleType: "SUV", capacity: 6, eventIds: [JDE] },
];

describe("conductor según el tipo de flota del viaje manual", () => {
  it("con SUV pedido, sólo los SUV del evento", () => {
    expect(conductoresParaViaje(opciones, { eventoId: RUGBY, tipo: "SUV" }).map((o) => o.value)).toEqual(["carlos"]);
  });

  it("sin tipo pedido, todos los del evento (con cupo para los pasajeros)", () => {
    expect(conductoresParaViaje(opciones, { eventoId: RUGBY }).map((o) => o.value)).toEqual(["carlos", "luis", "alejandro"]);
    expect(conductoresParaViaje(opciones, { eventoId: RUGBY, pasajeros: 12 }).map((o) => o.value)).toEqual(["carlos", "luis"]);
  });

  it("el conductor ya elegido no desaparece al editar", () => {
    expect(conductoresParaViaje(opciones, { eventoId: RUGBY, tipo: "SUV", elegido: "luis" }).map((o) => o.value)).toEqual(["carlos", "luis"]);
  });

  it("reconoce los tipos escritos de distintas formas", () => {
    expect(tipoFlota("Van 15-17")).toBe("VAN_15");
    expect(tipoFlota("Sedán")).toBe("SEDAN");
    expect(tipoFlota("mini bus")).toBe("MINIBUS");
    expect(tipoFlota("suv")).toBe("SUV");
    expect(tipoFlota("")).toBeNull();
  });
});
