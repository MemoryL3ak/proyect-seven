import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 29-09-2026: "al proveedor debería aparecer lo que dice valor proveedor, no
 * valor cliente ni valor licitado". La app del conductor mostraba el valor
 * del viaje (lo que se cobra al cliente) en cada actividad, en el historial y
 * en el total de Reportes.
 */
const portal = readFileSync(join(__dirname, "..", "app", "portal", "conductor", "page.tsx"), "utf8");

describe("app del conductor: valor proveedor", () => {
  it("pide el valor proveedor de sus viajes", () => {
    expect(portal).toContain('apiFetch<Record<string, number | null>>("/trips/valores-proveedor")');
  });

  it("ya no muestra el valor cliente en ninguna parte", () => {
    expect(portal).not.toContain("tripCost");
    expect(portal).toContain('stat("Valor", valorProveedor(trip) != null');
    expect(portal).toContain("completed.reduce((sum, t) => sum + (valorProveedor(t) ?? 0), 0)");
  });
});
