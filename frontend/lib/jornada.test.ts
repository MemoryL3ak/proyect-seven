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

/* ─── Jornada de 13 h: extras y cierre (24-09-2026) ─── */
import { calcularJornadas, jornadaDe } from "./jornada";

describe("jornadaDe", () => {
  const H = 60 * 60 * 1000;
  const t0 = new Date("2026-09-23T07:30:00-03:00");
  const iso = (h: number) => new Date(t0.getTime() + h * H).toISOString();

  it("cerrada dentro del plazo: sin extras, cierra con el último viaje", () => {
    const j = jornadaDe("d1", [
      { status: "COMPLETED", startedAt: iso(0), completedAt: iso(1.5) },
      { status: "COMPLETED", startedAt: iso(9), completedAt: iso(11) },
    ], new Date(t0.getTime() + 20 * H));
    expect(j.estado).toBe("CERRADA");
    expect(j.trabajadoMs).toBe(11 * H);
    expect(j.extraMs).toBe(0);
    expect(j.cierre?.toISOString()).toBe(iso(11));
  });

  it("cerrada pasado el plazo: las extras son lo que pasó de las 13 h", () => {
    const j = jornadaDe("d1", [
      { status: "COMPLETED", startedAt: iso(0), completedAt: iso(2) },
      { status: "COMPLETED", startedAt: iso(13), completedAt: iso(14.5) },
    ], new Date(t0.getTime() + 20 * H));
    expect(j.estado).toBe("CERRADA");
    expect(j.extraMs).toBe(1.5 * H);
  });

  it("abierta con un viaje pendiente pasado el plazo: en extras, contando hasta ahora", () => {
    const ahora = new Date(t0.getTime() + 14 * H);
    const j = jornadaDe("d1", [
      { status: "COMPLETED", startedAt: iso(0), completedAt: iso(2) },
      { status: "SCHEDULED", scheduledAt: iso(15) },
    ], ahora);
    expect(j.estado).toBe("EXTRA");
    expect(j.extraMs).toBe(1 * H);
    expect(j.pendientes).toBe(1);
  });

  it("por vencer cuando falta una hora o menos", () => {
    const j = jornadaDe("d1", [{ status: "PICKED_UP", startedAt: iso(0) }], new Date(t0.getTime() + 12.5 * H));
    expect(j.estado).toBe("POR_VENCER");
  });

  it("sin viajes iniciados no hay jornada", () => {
    const j = jornadaDe("d1", [{ status: "SCHEDULED", scheduledAt: iso(2) }], new Date(t0.getTime() + 5 * H));
    expect(j.estado).toBe("SIN_INICIAR");
    expect(j.trabajadoMs).toBe(0);
  });

  it("calcularJornadas agrupa por conductor y pone primero a quien está en extras", () => {
    const ahora = new Date(t0.getTime() + 14 * H);
    const filas = calcularJornadas([
      { driverId: "a", status: "COMPLETED", startedAt: iso(5), completedAt: iso(6) },
      { driverId: "b", status: "EN_ROUTE", startedAt: iso(0) },
      { driverId: "c", status: "SCHEDULED", scheduledAt: iso(16) },
      { driverId: null, status: "COMPLETED", startedAt: iso(0) },
    ], ahora);
    expect(filas.map((f) => `${f.driverId}:${f.estado}`)).toEqual(["b:EXTRA", "a:CERRADA", "c:SIN_INICIAR"]);
  });
});
