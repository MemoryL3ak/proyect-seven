import { describe, expect, it } from "vitest";
import { cargaDeRastreo } from "./sesion-shell";

describe("carga de rastreo para el shell", () => {
  it("lleva la sesión del portal cuando este teléfono la tiene", () => {
    expect(cargaDeRastreo("81376e2d", "s-123")).toEqual({ driverId: "81376e2d", sessionId: "s-123" });
  });

  it("sin sesión guardada manda sólo el conductor (shell y servidor siguen como antes)", () => {
    expect(cargaDeRastreo("81376e2d", null)).toEqual({ driverId: "81376e2d" });
    expect(cargaDeRastreo("81376e2d", "")).toEqual({ driverId: "81376e2d" });
  });
});
