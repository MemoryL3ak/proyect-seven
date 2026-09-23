import { describe, expect, it } from "vitest";
import { horaRegresoDeViaje } from "./viajeRegreso";

describe("horaRegresoDeViaje", () => {
  it("toma la hora del tramo de regreso anidado", () => {
    expect(
      horaRegresoDeViaje({
        returnAt: "2026-10-01T10:00:00.000Z",
        childTrips: [{ legType: "RETURN", scheduledAt: "2026-10-01T18:30:00.000Z" }],
      }),
    ).toBe("2026-10-01T18:30:00.000Z");
  });

  it("prefiere el tramo RETURN aunque haya otros hijos", () => {
    expect(
      horaRegresoDeViaje({
        childTrips: [
          { legType: "OUTBOUND", scheduledAt: "2026-10-01T08:00:00.000Z" },
          { legType: "RETURN", scheduledAt: "2026-10-01T18:30:00.000Z" },
        ],
      }),
    ).toBe("2026-10-01T18:30:00.000Z");
  });

  it("cae a returnAt (planilla) cuando no hay tramo de regreso", () => {
    expect(horaRegresoDeViaje({ returnAt: "2026-10-01T18:00:00.000Z", childTrips: [] })).toBe(
      "2026-10-01T18:00:00.000Z",
    );
  });

  it("sin regreso devuelve null", () => {
    expect(horaRegresoDeViaje({})).toBeNull();
    expect(horaRegresoDeViaje(null)).toBeNull();
  });
});
