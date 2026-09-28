import { describe, expect, it } from "vitest";
import { aplanarTramos, esLlegada, esSalida, sentidoTraslado, type TramoTraslado } from "./tramos-traslado";

/**
 * 28-09-2026: Ariel quiere un solo viaje Transfer In Out por persona. La
 * llegada de Sergio Alvarenga es el viaje y su salida el tramo de regreso,
 * anidado en childTrips: los monitores tienen que encontrar los dos.
 */
const salida: TramoTraslado = {
  id: "out-sergio",
  tripType: "TRANSFER_IN_OUT",
  legType: "RETURN",
  parentTripId: "in-sergio",
  metadata: { andKey: "and:sergio:SALIDA", flightNumber: "LA1325" },
};
const llegada: TramoTraslado = {
  id: "in-sergio",
  tripType: "TRANSFER_IN_OUT",
  legType: "OUTBOUND",
  parentTripId: null,
  metadata: { andKey: "and:sergio:LLEGADA", flightNumber: "LA1324" },
  childTrips: [salida],
};

describe("tramos de un Transfer In Out", () => {
  it("despliega el tramo de regreso sin repetir viajes", () => {
    const otro: TramoTraslado = { id: "entrenamiento", tripType: "Entrenamiento", childTrips: [] };
    expect(aplanarTramos([llegada, otro, { ...salida, childTrips: [] }]).map((v) => v.id)).toEqual([
      "in-sergio",
      "out-sergio",
      "entrenamiento",
    ]);
  });

  it("la llegada es la ida y la salida el regreso", () => {
    expect(sentidoTraslado(llegada)).toBe("LLEGADA");
    expect(sentidoTraslado(salida)).toBe("SALIDA");
    expect(esLlegada(llegada)).toBe(true);
    expect(esSalida(llegada)).toBe(false);
  });

  it("un Transfer In Out cargado a mano en Viajes: la ida llega y el regreso sale", () => {
    expect(sentidoTraslado({ tripType: "TRANSFER_IN_OUT", legType: "OUTBOUND" })).toBe("LLEGADA");
    expect(sentidoTraslado({ tripType: "TRANSFER_IN_OUT", legType: "RETURN", parentTripId: "x" })).toBe("SALIDA");
  });

  it("reconoce los Transfer In y Transfer Out sueltos de antes, y nada más", () => {
    expect(sentidoTraslado({ tripType: "TRANSFER_IN" })).toBe("LLEGADA");
    expect(sentidoTraslado({ tripType: "TRANSFER_OUT" })).toBe("SALIDA");
    expect(sentidoTraslado({ tripType: "Entrenamiento" })).toBeNull();
  });
});
