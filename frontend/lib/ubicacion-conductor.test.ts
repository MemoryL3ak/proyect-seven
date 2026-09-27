import { describe, expect, it } from "vitest";
import { appYaRastrea, clasificarErrorUbicacionNativa } from "./ubicacion-conductor";

/**
 * 27-09-2026: Héctor Silva veía "Ubicación no disponible" al tocar los
 * botones del viaje en su iPhone, con la app mandando su GPS sin cortes. La
 * comprobación ahora se le pregunta a la app y no al navegador interno.
 */
describe("appYaRastrea", () => {
  it("con el rastreo de la app andando no se vuelve a preguntar (el caso de Héctor)", () => {
    expect(appYaRastrea({ running: true })).toBe(true);
  });
  it("sin rastreo, o sin saberlo, sí", () => {
    expect(appYaRastrea({ running: false })).toBe(false);
    expect(appYaRastrea(null)).toBe(false);
    expect(appYaRastrea(undefined)).toBe(false);
  });
});

describe("clasificarErrorUbicacionNativa", () => {
  it("lee los mensajes del handler location.current de la app", () => {
    expect(clasificarErrorUbicacionNativa("Permiso de ubicación bloqueado en Ajustes")).toBe("BLOQUEADA");
    expect(clasificarErrorUbicacionNativa("Permiso de ubicación no concedido")).toBe("DENEGADA");
  });
  it("una app antigua o sin respuesta no dice nada del permiso: se prueba con el navegador", () => {
    expect(clasificarErrorUbicacionNativa('no handler registered for "location.current"')).toBe("SIN_RESPUESTA");
    expect(clasificarErrorUbicacionNativa('bridge.request("location.current") timed out after 15000ms')).toBe("SIN_RESPUESTA");
    expect(clasificarErrorUbicacionNativa(undefined)).toBe("SIN_RESPUESTA");
  });
});
