import { describe, expect, it } from "vitest";
import { gpsWebNecesario, viajesPorCalificar } from "./conductor-sondeos";

const T = Date.parse("2026-09-23T15:00:00.000Z");
const hace = (h: number) => new Date(T - h * 3600_000).toISOString();

describe("viajesPorCalificar", () => {
  it("sólo los cerrados hace menos de un día, sin calificación y no consultados", () => {
    const trips = [
      { id: "hoy", status: "COMPLETED", completedAt: hace(2) },
      { id: "ayer", status: "COMPLETED", completedAt: hace(30) },
      { id: "calificado", status: "COMPLETED", completedAt: hace(1), driverRating: 5 },
      { id: "ya-visto", status: "COMPLETED", completedAt: hace(1) },
      { id: "en-curso", status: "EN_ROUTE", startedAt: hace(1) },
      { id: "dejado", status: "DROPPED_OFF", startedAt: hace(3) },
    ];
    expect(viajesPorCalificar(trips, new Set(["ya-visto"]), T)).toEqual(["hoy", "dejado"]);
  });

  it("sin fecha de cierre ni de inicio no se consulta", () => {
    expect(viajesPorCalificar([{ id: "x", status: "COMPLETED" }], new Set(), T)).toEqual([]);
  });
});

describe("gpsWebNecesario", () => {
  it("en el navegador siempre manda la web", () => {
    expect(gpsWebNecesario({ running: true, backgroundOk: true }, false)).toBe(true);
  });

  it("dentro de la app, con el shell rastreando en segundo plano, la web no duplica", () => {
    expect(gpsWebNecesario({ running: true, backgroundOk: true }, true)).toBe(false);
  });

  it("dentro de la app sin rastreo nativo (shell viejo, sin permiso o apagado) la web cubre", () => {
    expect(gpsWebNecesario(null, true)).toBe(true);
    expect(gpsWebNecesario({ running: true, backgroundOk: false }, true)).toBe(true);
    expect(gpsWebNecesario({ running: false, backgroundOk: true }, true)).toBe(true);
  });
});
