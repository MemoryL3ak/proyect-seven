import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codigoDePais, nombreDePais, paisPorInformar, PAISES } from "./paises";

/**
 * 28-09-2026: la carga de AND de World Rugby daba "País/código inválido" en
 * las 14 filas: Namibia, Bélgica, Rumania, Hong Kong China y "Por informar".
 */
describe("país en las cargas masivas", () => {
  it("reconoce los nombres de la planilla de World Rugby", () => {
    expect(codigoDePais("Namibia")).toBe("NAM");
    expect(codigoDePais("Bélgica")).toBe("BEL");
    expect(codigoDePais("Rumania")).toBe("ROU");
    expect(codigoDePais("Rumanía")).toBe("ROU");
    expect(codigoDePais("Hong Kong China")).toBe("HKG");
    expect(codigoDePais("Hong Kong, China")).toBe("HKG");
  });

  it("acepta el código, en mayúsculas o no, y nombres en inglés", () => {
    expect(codigoDePais("nam")).toBe("NAM");
    expect(codigoDePais("CHL")).toBe("CHL");
    expect(codigoDePais("Chile")).toBe("CHL");
    expect(codigoDePais("Belgium")).toBe("BEL");
    expect(codigoDePais("Romania")).toBe("ROU");
    expect(codigoDePais("Estados Unidos")).toBe("USA");
  });

  it("\"Por informar\" o vacío es sin país, no un error", () => {
    expect(paisPorInformar("Por informar")).toBe(true);
    expect(paisPorInformar("")).toBe(true);
    expect(codigoDePais("Por informar")).toBe("");
    expect(paisPorInformar("Namibia")).toBe(false);
  });

  it("un país inventado no se acepta", () => {
    expect(codigoDePais("Narnia")).toBe("");
  });

  it("Hong Kong ya se puede elegir en la ficha", () => {
    expect(PAISES.some((p) => p.value === "HKG")).toBe(true);
    expect(nombreDePais("HKG")).toBe("Hong Kong");
  });

  it("la carga masiva valida con el código ya traducido", () => {
    const panel = readFileSync(join(__dirname, "..", "components", "BulkImportPanel.tsx"), "utf8");
    expect(panel).toContain("!normalizeCountryCode(row.country_code) && !paisPorInformar(row.country_code)");
    expect(panel).not.toContain("row.country_code.length !== 3");
  });
});
