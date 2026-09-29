import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filterPasajerosDeVuelos } from "./athletes";

/**
 * 28-09-2026: "a los coordinadores de BVAN no les aparece el listado de los
 * vuelos". Las 14 fichas de AND con vuelo de World Rugby estaban sin validar
 * (REGISTERED) y los monitores sólo mostraban las validadas: salía un vuelo.
 */
describe("pasajeros de los monitores de vuelos", () => {
  it("entran validadas o no; las eliminadas no", () => {
    const fichas = [
      { id: "namibia", status: "REGISTERED" },
      { id: "ginzo", status: "PERSONAL_DATA_VALIDATED" },
      { id: "baja", status: "DELETED" },
    ];
    expect(filterPasajerosDeVuelos(fichas).map((f) => f.id)).toEqual(["namibia", "ginzo"]);
  });

  it("Llegadas y Salidas usan esa regla", () => {
    const leer = (...r: string[]) => readFileSync(join(__dirname, "..", ...r), "utf8");
    for (const pagina of [leer("app", "(main)", "operations", "flights", "page.tsx"), leer("app", "(main)", "operacion", "salidas", "page.tsx")]) {
      expect(pagina).toContain("filterPasajerosDeVuelos(");
      expect(pagina).not.toContain("filterValidatedAthletes(");
    }
  });
});
