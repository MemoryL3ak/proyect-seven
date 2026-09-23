import { describe, expect, it } from "vitest";
import { esPorRealizar } from "./traslados-por-realizar";

/**
 * Pedido de Ariel del 23-09-2026: "Por realizar" son los traslados desde la
 * hora actual hacia el futuro. Los programados cuya hora ya pasó y nadie
 * inició no se muestran; los que van andando sí, aunque hayan salido tarde.
 */
const ahora = new Date("2026-09-23T15:00:00-03:00").getTime();

describe("esPorRealizar", () => {
  it("un programado con hora futura está por realizar", () => {
    expect(esPorRealizar({ status: "SCHEDULED", scheduledAt: "2026-09-23T15:30:00-03:00" }, ahora)).toBe(true);
    expect(esPorRealizar({ status: "REQUESTED", scheduledAt: "2026-09-24T09:00:00-03:00" }, ahora)).toBe(true);
  });

  it("uno cuya hora ya pasó y nadie inició sale de la vista", () => {
    expect(esPorRealizar({ status: "SCHEDULED", scheduledAt: "2026-09-23T14:59:00-03:00" }, ahora)).toBe(false);
    expect(esPorRealizar({ status: "scheduled", scheduledAt: "2026-09-23T08:00:00-03:00" }, ahora)).toBe(false);
  });

  it("el de la hora exacta todavía cuenta", () => {
    expect(esPorRealizar({ status: "SCHEDULED", scheduledAt: "2026-09-23T15:00:00-03:00" }, ahora)).toBe(true);
  });

  it("los que van en ruta se quedan aunque hayan salido tarde", () => {
    expect(esPorRealizar({ status: "EN_ROUTE", scheduledAt: "2026-09-23T13:00:00-03:00" }, ahora)).toBe(true);
    expect(esPorRealizar({ status: "PICKED_UP", scheduledAt: "2026-09-23T13:00:00-03:00" }, ahora)).toBe(true);
  });

  it("los terminados o cancelados nunca están por realizar", () => {
    expect(esPorRealizar({ status: "COMPLETED", scheduledAt: "2026-09-23T16:00:00-03:00" }, ahora)).toBe(false);
    expect(esPorRealizar({ status: "CANCELLED", scheduledAt: "2026-09-23T16:00:00-03:00" }, ahora)).toBe(false);
  });

  it("sin hora no hay con qué descartarlo", () => {
    expect(esPorRealizar({ status: "SCHEDULED", scheduledAt: null }, ahora)).toBe(true);
    expect(esPorRealizar({ status: "SCHEDULED", scheduledAt: "no es fecha" }, ahora)).toBe(true);
  });
});
