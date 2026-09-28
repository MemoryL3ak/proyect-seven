import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 28-09-2026: los coordinadores de sede de World Rugby (Danyel Pereira,
 * Salvador Aedo) entran a la app como Coordinadores de Transporte y pidieron
 * "que aparezca vuelos". La pestaña va para los coordinadores de evento
 * (Comité y Transporte) y para el Coordinador de Sede.
 */
const pagina = readFileSync(join(__dirname, "..", "app", "portal", "user", "page.tsx"), "utf8");

describe("pestaña Vuelos del portal", () => {
  it("está en el menú de los coordinadores de evento, con y sin Conductores", () => {
    const orden = pagina.slice(pagina.indexOf("const ORDEN_COMITE"), pagina.indexOf("return ORDEN_COMITE"));
    expect(orden).toContain('["actividades", "vuelos", "conductores"');
    expect(orden).toContain('["actividades", "vuelos", "calendario"');
  });

  it("está en el menú del Coordinador de Sede", () => {
    const orden = pagina.slice(pagina.indexOf("const ORDEN_SEDE"), pagina.indexOf("const ORDEN_SEDE") + 200);
    expect(orden).toContain('"vuelos", "conductores"');
  });

  it("se muestra para los tres", () => {
    expect(pagina).toContain('activeTab === "vuelos" && (esSede || isComite)');
  });
});
