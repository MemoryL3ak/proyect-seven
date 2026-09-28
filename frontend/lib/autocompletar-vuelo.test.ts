import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { autocompletaConVuelo } from "./autocompletar-vuelo";

describe("autocompletar con el número de vuelo", () => {
  it("en Viajes no toca el origen: es el lugar de recogida, no la ciudad del vuelo", () => {
    expect(autocompletaConVuelo("/trips")).toBe(false);
  });

  it("en Participantes, Delegaciones y Vuelos sí completa aerolínea y origen", () => {
    expect(autocompletaConVuelo("/athletes")).toBe(true);
    expect(autocompletaConVuelo("/delegations")).toBe(true);
    expect(autocompletaConVuelo("/flights")).toBe(true);
  });

  it("el formulario consulta la regla antes de buscar el vuelo", () => {
    const pantalla = readFileSync(join(__dirname, "..", "components", "ResourceScreen.tsx"), "utf8");
    const inicio = pantalla.indexOf("const isDelegationsEndpoint = config.endpoint === \"/delegations\";");
    expect(inicio).toBeGreaterThan(0);
    const antes = pantalla.slice(Math.max(0, inicio - 300), inicio);
    expect(antes).toContain("if (!autocompletaConVuelo(config.endpoint)) return;");
  });
});
