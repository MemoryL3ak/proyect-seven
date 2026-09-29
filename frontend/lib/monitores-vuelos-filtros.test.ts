import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 28-09-2026: "crear filtros en ambos vuelos, y que nos aparezca en cada
 * vuelo la información del conductor". Los dos monitores filtran con el
 * selector del panel (nunca <select> nativo) y muestran el conductor.
 */
const leer = (...ruta: string[]) => readFileSync(join(__dirname, "..", ...ruta), "utf8");
const llegadas = leer("app", "(main)", "operations", "flights", "page.tsx");
const salidas = leer("app", "(main)", "operacion", "salidas", "page.tsx");

describe("monitores de Llegadas y Salidas", () => {
  it("filtran por traslado y conductor con StyledSelect", () => {
    for (const pagina of [llegadas, salidas]) {
      expect(pagina).toContain("OPCIONES_FILTRO_TRASLADO");
      expect(pagina).toContain("cumpleFiltroConductor");
      expect(pagina).not.toMatch(/<select className="input"[^>]*value=\{(filterDelegation|filterStatus|delegacionId)\}/);
    }
  });

  it("muestran la columna Conductor", () => {
    expect(llegadas).toContain('"Traslado", "Conductor", "Acciones"');
    expect(salidas).toContain('"Traslado al aeropuerto", "Conductor"');
  });
});
