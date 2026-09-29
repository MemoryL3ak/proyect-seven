import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 28-09-2026: "cuando creo viajes manuales aparece por defecto un valor de
 * 180k". El formulario de Viajes copiaba al costo una tabla de precios fija
 * (Viaje de ida en Bus = 180.000) y quedaba como precio pactado del viaje,
 * por encima de la tarifa del proveedor en el panel financiero.
 */
const formulario = readFileSync(join(__dirname, "..", "components", "ResourceScreen.tsx"), "utf8");

describe("costo de un viaje manual", () => {
  it("el formulario no trae precios inventados", () => {
    expect(formulario).not.toMatch(/BUS:\s*180000/);
    expect(formulario).not.toContain("const costs: Record<string, Record<string, number>>");
  });

  it("no completa el costo solo al elegir servicio o flota", () => {
    expect(formulario).not.toContain("tripCost: formatCurrencyCLP(nextCost)");
  });
});
