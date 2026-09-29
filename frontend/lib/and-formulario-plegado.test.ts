import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resources } from "./resources";

/**
 * 28-09-2026: "en la parte web de AND me puedes dejar como cerrado y yo
 * pinchar o un botón para crear nuevo registro". El formulario ocupaba la
 * pantalla antes de la lista.
 */
const pantalla = readFileSync(join(__dirname, "..", "components", "ResourceScreen.tsx"), "utf8");

describe("AND: formulario de alta plegado en la web", () => {
  it("AND lo tiene plegado; el resto sigue igual", () => {
    expect(resources.delegations.formularioPlegado).toBe(true);
    expect(resources.events.formularioPlegado).toBeFalsy();
  });

  it("se pliega también fuera del teléfono y se cierra al guardar", () => {
    expect(pantalla).toContain('const formCollapsible = (isMobile || !!config.formularioPlegado) && viewMode === "both";');
    expect(pantalla).toContain("if (formCollapsible) setFormOpen(false);");
  });
});
