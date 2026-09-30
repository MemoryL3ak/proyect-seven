import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { consultaRastreo, fechaDelVuelo } from "./fecha-vuelo";

/**
 * 30-09-2026: el CM497 que aterriza el 29-09 a las 23:39 en Santiago se
 * rastreaba como vuelo del 30 (02:39 UTC), que todavía no salía.
 */
describe("día del vuelo para rastrearlo", () => {
  it("es el día en Santiago, no en UTC", () => {
    expect(new Date("2026-09-30T02:39:00.000Z").toISOString().slice(0, 10)).toBe("2026-09-30"); // lo de antes
    expect(fechaDelVuelo("2026-09-30T02:39:00.000Z")).toBe("2026-09-29");
    expect(fechaDelVuelo("2026-09-29T18:30:00.000Z")).toBe("2026-09-29");
    expect(fechaDelVuelo(null)).toBe("");
  });

  it("arma la consulta con ese día", () => {
    expect(consultaRastreo("CM497", "2026-09-30T02:39:00.000Z")).toBe("/flights/track?flightNumber=CM497&flightDate=2026-09-29");
    expect(consultaRastreo("LA 407", null)).toBe("/flights/track?flightNumber=LA%20407");
  });

  it("el panel y la app del conductor la usan", () => {
    const leer = (...r: string[]) => readFileSync(join(__dirname, "..", ...r), "utf8");
    for (const archivo of [leer("app", "(main)", "operations", "flights", "page.tsx"), leer("app", "portal", "conductor", "page.tsx")]) {
      expect(archivo).toContain("consultaRastreo(");
      expect(archivo).not.toMatch(/rrivalTime\)\.toISOString\(\)\.slice\(0, 10\)/);
      expect(archivo).toContain('unknown:');
    }
  });
});
