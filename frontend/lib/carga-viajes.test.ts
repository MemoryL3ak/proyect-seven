import { describe, expect, it } from "vitest";
import { REFERENCIAS_CADA_MS, referenciasVencidas, rutaViajes } from "./carga-viajes";

describe("carga de la página de Viajes (13-10-2026: 4,8 MB cada 8 s en Safari)", () => {
  it("pide sólo los viajes del evento activo; sin evento elegido, todos como antes", () => {
    expect(rutaViajes("8bbd6a39-a788-4588-9c15-7aec86080dba")).toBe("/trips?eventId=8bbd6a39-a788-4588-9c15-7aec86080dba");
    expect(rutaViajes(null)).toBe("/trips");
    expect(rutaViajes("")).toBe("/trips");
  });

  it("las referencias (atletas, conductores, sedes…) se renuevan cada 5 minutos, no en cada tic de 8 s", () => {
    const t0 = 1_000_000;
    expect(referenciasVencidas(0, t0)).toBe(true);
    expect(referenciasVencidas(t0, t0 + 8_000)).toBe(false);
    expect(referenciasVencidas(t0, t0 + 4 * 60_000)).toBe(false);
    expect(referenciasVencidas(t0, t0 + REFERENCIAS_CADA_MS)).toBe(true);
  });
});
