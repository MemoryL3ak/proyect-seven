import { describe, expect, it } from "vitest";
import { estadoVuelo } from "./estado-vuelo";

// LA1324 de Sergio Alvarenga: aterrizaje programado 28-09-2026 14:15 (Chile).
const LA1324 = "2026-09-28T17:15:00.000Z";

describe("estado del vuelo en el Monitoreo de Llegadas", () => {
  it("pasada la hora de llegada es Arribado, aunque sea hoy", () => {
    expect(estadoVuelo(LA1324, new Date("2026-09-28T18:45:00.000Z"))).toBe("ARRIBADO");
  });

  it("hoy y antes de la hora de llegada es Hoy", () => {
    expect(estadoVuelo(LA1324, new Date("2026-09-28T13:00:00.000Z"))).toBe("HOY");
  });

  it("otro día es Programado", () => {
    expect(estadoVuelo(LA1324, new Date("2026-09-27T20:00:00.000Z"))).toBe("PROGRAMADO");
  });

  it("si el conductor ya recogió al pasajero, arribó aunque no sea la hora", () => {
    expect(estadoVuelo(LA1324, new Date("2026-09-28T17:05:00.000Z"), ["PICKED_UP"])).toBe("ARRIBADO");
    expect(estadoVuelo(LA1324, new Date("2026-09-28T17:05:00.000Z"), ["EN_ROUTE"])).toBe("HOY");
  });

  it("el día se cuenta en hora de Chile: 23:30 del 28 sigue siendo el 28", () => {
    // 29-09 02:30 UTC = 28-09 23:30 en Chile.
    expect(estadoVuelo("2026-09-29T02:30:00.000Z", new Date("2026-09-28T20:00:00.000Z"))).toBe("HOY");
  });
});
