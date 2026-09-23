import { describe, expect, it } from "vitest";
import { inicioDeJornada } from "./jornada";

describe("inicioDeJornada", () => {
  it("toma el primer viaje iniciado", () => {
    expect(
      inicioDeJornada([
        { status: "DROPPED_OFF", startedAt: "2026-09-23T11:23:03Z" },
        { status: "EN_ROUTE", startedAt: "2026-09-23T10:05:00Z" },
        { status: "SCHEDULED", startedAt: null },
      ])?.toISOString(),
    ).toBe("2026-09-23T10:05:00.000Z");
  });

  it("ignora el inicio viejo de un viaje devuelto a Programado", () => {
    // Caso real del 22-09: iniciado y cerrado por error a las 18:55, devuelto
    // a Programado por el panel; el startedAt quedó guardado.
    expect(
      inicioDeJornada([
        { status: "SCHEDULED", startedAt: "2026-09-22T21:55:00Z" },
        { status: "SCHEDULED", startedAt: "2026-09-22T21:56:00Z" },
        { status: "DROPPED_OFF", startedAt: "2026-09-23T11:23:03Z" },
      ])?.toISOString(),
    ).toBe("2026-09-23T11:23:03.000Z");
  });

  it("un viaje en ruta sin hora de inicio igual arranca la jornada", () => {
    // Caso real del 23-09 (Alex Arevalo): 07:45 dejado sin inicio ni cierre,
    // modificado a las 08:00; el resto programado. Figuraba "Sin iniciar".
    expect(
      inicioDeJornada([
        { status: "DROPPED_OFF", startedAt: null, completedAt: null, updatedAt: "2026-09-23T11:00:00Z", scheduledAt: "2026-09-23T10:45:00Z" },
        { status: "SCHEDULED", scheduledAt: "2026-09-23T15:50:00Z" },
      ])?.toISOString(),
    ).toBe("2026-09-23T10:45:00.000Z");
    // En ruta antes de la hora programada: manda la última modificación.
    expect(
      inicioDeJornada([
        { status: "EN_ROUTE", startedAt: null, updatedAt: "2026-09-23T10:37:00Z", scheduledAt: "2026-09-23T15:50:00Z" },
      ])?.toISOString(),
    ).toBe("2026-09-23T10:37:00.000Z");
  });

  it("sin viajes en marcha no hay jornada", () => {
    expect(inicioDeJornada([{ status: "SCHEDULED", startedAt: "2026-09-22T21:55:00Z" }])).toBeNull();
    expect(inicioDeJornada([{ status: "EN_ROUTE" }])).toBeNull();
    expect(inicioDeJornada([])).toBeNull();
  });
});
