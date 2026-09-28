import { describe, expect, it } from "vitest";
import { horaDelVuelo, lineaDeTraslado, pasoSiguiente } from "./linea-traslado";

/**
 * 28-09-2026: línea de tiempo de los traslados en los monitores de llegadas y
 * salidas. La bitácora es la de un viaje real de ese día.
 */
const BITACORA = [
  { at: "2026-09-28T13:40:00.000Z", action: "STATUS_CHANGED", detail: "SCHEDULED → EN_ROUTE" },
  { at: "2026-09-28T17:35:00.000Z", action: "STATUS_CHANGED", detail: "EN_ROUTE → PICKED_UP" },
  { at: "2026-09-28T18:40:00.000Z", action: "STATUS_CHANGED", detail: "PICKED_UP → DROPPED_OFF" },
];
const LLEGADA = {
  tripType: "TRANSFER_IN",
  scheduledAt: "2026-09-28T17:15:00.000Z",
  metadata: { flightTime: "2026-09-28T17:15:00.000Z" },
};

describe("lineaDeTraslado · llegada", () => {
  it("programado y el vuelo aún no llega: nada marcado", () => {
    const pasos = lineaDeTraslado({ ...LLEGADA, status: "SCHEDULED" }, new Date("2026-09-28T15:00:00Z"));
    expect(pasos.map((p) => p.clave)).toEqual(["EN_CAMINO", "ATERRIZADO", "RECOGIDO", "COMPLETADO"]);
    expect(pasos.every((p) => !p.hecho)).toBe(true);
    expect(pasoSiguiente(pasos)).toBe("EN_CAMINO");
  });

  it("el conductor inició y el vuelo aterrizó por hora", () => {
    const pasos = lineaDeTraslado(
      { ...LLEGADA, status: "EN_ROUTE", metadata: { ...LLEGADA.metadata, log: BITACORA.slice(0, 1) } },
      new Date("2026-09-28T17:20:00Z"),
    );
    expect(pasos.find((p) => p.clave === "EN_CAMINO")).toMatchObject({ hecho: true, hora: "2026-09-28T13:40:00.000Z" });
    expect(pasos.find((p) => p.clave === "ATERRIZADO")).toMatchObject({ hecho: true, hora: "2026-09-28T17:15:00.000Z" });
    expect(pasoSiguiente(pasos)).toBe("RECOGIDO");
  });

  it("completo, con la hora de cada paso según la bitácora", () => {
    const pasos = lineaDeTraslado(
      { ...LLEGADA, status: "DROPPED_OFF", metadata: { ...LLEGADA.metadata, log: BITACORA } },
      new Date("2026-09-28T19:00:00Z"),
    );
    expect(pasos.map((p) => p.hora)).toEqual([
      "2026-09-28T13:40:00.000Z",
      "2026-09-28T17:15:00.000Z",
      "2026-09-28T17:35:00.000Z",
      "2026-09-28T18:40:00.000Z",
    ]);
    expect(pasoSiguiente(pasos)).toBeNull();
  });

  it("recogido antes de la hora prevista: el vuelo se adelantó y cuenta como aterrizado", () => {
    const pasos = lineaDeTraslado({ ...LLEGADA, status: "PICKED_UP" }, new Date("2026-09-28T17:00:00Z"));
    expect(pasos.find((p) => p.clave === "ATERRIZADO")?.hecho).toBe(true);
  });

  it("cerrado desde el panel sin bitácora: usa inicio y cierre del viaje", () => {
    const pasos = lineaDeTraslado(
      { ...LLEGADA, status: "COMPLETED", startedAt: "2026-09-28T17:30:00Z", completedAt: "2026-09-28T18:30:00Z" },
      new Date("2026-09-28T19:00:00Z"),
    );
    expect(pasos.find((p) => p.clave === "COMPLETADO")).toMatchObject({ hecho: true, hora: "2026-09-28T18:30:00Z" });
  });
});

describe("lineaDeTraslado · salida", () => {
  const SALIDA = {
    tripType: "TRANSFER_OUT",
    scheduledAt: "2026-10-18T15:05:00.000Z",
    metadata: { flightTime: "2026-10-18T18:05:00.000Z" },
  };
  it("en camino al hotel, el vuelo todavía no sale", () => {
    const pasos = lineaDeTraslado({ ...SALIDA, status: "EN_ROUTE" }, new Date("2026-10-18T15:00:00Z"));
    expect(pasos.map((p) => p.clave)).toEqual(["EN_CAMINO", "RECOGIDO", "COMPLETADO", "DESPEGO"]);
    expect(pasos.map((p) => p.etiqueta)).toEqual(["En camino", "Recogido en hotel", "En el aeropuerto", "Despegó"]);
    expect(pasos.find((p) => p.clave === "DESPEGO")).toMatchObject({ hecho: false, prevista: "2026-10-18T18:05:00.000Z" });
  });
  it("después de la hora del vuelo, despegó", () => {
    const pasos = lineaDeTraslado({ ...SALIDA, status: "DROPPED_OFF" }, new Date("2026-10-18T18:30:00Z"));
    expect(pasos.find((p) => p.clave === "DESPEGO")?.hecho).toBe(true);
  });
});

describe("horaDelVuelo", () => {
  it("la de AND, o la del viaje en un Transfer In", () => {
    expect(horaDelVuelo(LLEGADA)).toBe("2026-09-28T17:15:00.000Z");
    expect(horaDelVuelo({ tripType: "TRANSFER_IN", scheduledAt: "2026-09-28T10:00:00Z" })).toBe("2026-09-28T10:00:00Z");
    expect(horaDelVuelo({ tripType: "TRANSFER_OUT", scheduledAt: "2026-09-28T10:00:00Z" })).toBeNull();
  });
});
