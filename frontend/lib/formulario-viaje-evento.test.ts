import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 28-09-2026: el viaje manual de World Rugby ofrecía como "Recinto de
 * destino" el Estadio Elías Figueroa, la Escuela Naval y las otras sedes de
 * los Juegos Escolares. Sedes y comedores se acotan al evento del viaje.
 */
const formulario = readFileSync(join(__dirname, "..", "components", "ResourceScreen.tsx"), "utf8");

describe("formulario de viaje manual: sólo lo del evento", () => {
  it("sedes y comedores están entre los desplegables acotados al evento", () => {
    const linea = formulario.split("\n").find((l) => l.includes("const FUENTES_POR_EVENTO = new Set")) ?? "";
    expect(linea).toContain('"venues"');
    expect(linea).toContain('"foodLocations"');
  });

  it("cada sede lleva su evento", () => {
    const cargaSedes = formulario.slice(formulario.indexOf("const loadVenues"), formulario.indexOf("const loadFoodLocations"));
    expect(cargaSedes).toContain("eventId: venue.eventId ?? null");
  });
});
