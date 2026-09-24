import { describe, expect, it } from "vitest";
import { conGenero, generoDeViaje, generoNormalizado } from "./genero-viaje";

/**
 * 24-09-2026: en la web el traslado decía "Futsal Masculino · Masculino" y
 * en la app sólo "Futsal": el catálogo agrega el género únicamente cuando
 * el deporte existe en dos variantes. La app ahora lo toma del viaje.
 */
describe("generoNormalizado", () => {
  it("entiende las formas de la planilla", () => {
    expect(generoNormalizado("DAMAS")).toBe("Femenino");
    expect(generoNormalizado("varones")).toBe("Masculino");
    expect(generoNormalizado("Mixto")).toBe("Mixto");
    expect(generoNormalizado("f")).toBe("Femenino");
    expect(generoNormalizado("")).toBe("");
  });
});

describe("generoDeViaje", () => {
  it("prefiere el de los metadatos y cae al final del nombre de la disciplina", () => {
    expect(generoDeViaje({ discipline: "FUTSAL MASCULINO", metadata: { gender: "damas" } })).toBe("Femenino");
    expect(generoDeViaje({ discipline: "FUTSAL MASCULINO" })).toBe("Masculino");
    expect(generoDeViaje({ discipline: "ATLETISMO" })).toBe("");
  });
});

describe("conGenero", () => {
  it("agrega el género a la etiqueta del deporte sin repetirlo", () => {
    expect(conGenero("Futsal", "Masculino")).toBe("Futsal · Masculino");
    expect(conGenero("Atletismo · Femenino · Paralímpica", "Femenino")).toBe("Atletismo · Femenino · Paralímpica");
    expect(conGenero("Futsal", "")).toBe("Futsal");
    expect(conGenero(null, "Mixto")).toBeNull();
  });
});
