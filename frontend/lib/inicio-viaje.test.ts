import { describe, expect, it } from "vitest";
import { permisoDeInicio } from "./inicio-viaje";

/** Ariel, 24-09-2026: el conductor inicia desde 1 hora antes, no antes. */
describe("permisoDeInicio", () => {
  const programado = "2026-09-24T18:30:00-03:00";

  it("antes de la hora previa no se puede, y dice desde cuándo", () => {
    const p = permisoDeInicio(programado, new Date("2026-09-24T17:29:00-03:00"));
    expect(p.permitido).toBe(false);
    expect(p.desdeTexto).toBe("17:30");
  });

  it("desde una hora antes sí, y también después de la hora", () => {
    expect(permisoDeInicio(programado, new Date("2026-09-24T17:30:00-03:00")).permitido).toBe(true);
    expect(permisoDeInicio(programado, new Date("2026-09-24T19:10:00-03:00")).permitido).toBe(true);
  });

  it("un viaje sin hora se puede iniciar siempre", () => {
    expect(permisoDeInicio(null)).toEqual({ permitido: true, desde: null, desdeTexto: "" });
    expect(permisoDeInicio("no es fecha").permitido).toBe(true);
  });
});
