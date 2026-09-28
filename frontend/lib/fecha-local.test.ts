import { describe, expect, it } from "vitest";
import { isoDesdeLocal } from "./fecha-local";

/** 28-09-2026: la hora del formulario de AND se mandaba sin zona. */
describe("isoDesdeLocal", () => {
  it("la hora del formulario sale con su zona (la del navegador)", () => {
    expect(isoDesdeLocal("2026-09-28T14:15")).toBe(new Date(2026, 8, 28, 14, 15).toISOString());
  });
  it("una hora ya con zona se respeta", () => {
    expect(isoDesdeLocal("2026-09-28T17:15:00.000Z")).toBe("2026-09-28T17:15:00.000Z");
  });
  it("vacío o inválido: nada", () => {
    expect(isoDesdeLocal("")).toBeUndefined();
    expect(isoDesdeLocal("no")).toBeUndefined();
    expect(isoDesdeLocal(undefined)).toBeUndefined();
  });
});
