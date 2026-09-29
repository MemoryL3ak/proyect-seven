import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 28-09-2026: "esos botones de editar y borrar se ven mal" (calendario de
 * menús de Alimentación). Eran dos enlaces subrayados, y "borrar" eliminaba
 * el plato al primer toque.
 */
const calendario = readFileSync(join(__dirname, "..", "components", "FoodCalendar.tsx"), "utf8");

describe("acciones de cada plato del menú", () => {
  it("son botones de ícono, no enlaces subrayados", () => {
    expect(calendario).not.toContain('textDecoration: "underline" }}>{t("editar")}');
    expect(calendario).toContain("<PencilIcon");
    expect(calendario).toContain("<TrashIcon");
  });

  it("borrar pide confirmación", () => {
    expect(calendario).toContain("onClick={() => setPorBorrar(m)}");
    expect(calendario).toContain("<ConfirmDialog");
  });
});
