import { describe, expect, it } from "vitest";
import { coincideConductor, conductorPorCodigo } from "./conductor-por-codigo";

const manuelNuevo = { id: "d9ac6941-c2d0-4cd8-b405-ceb2a143c32f", userId: null };
const manuelViejo = { id: "35fd780c-97ea-40e4-9c36-2fa68decb2e4", userId: null };

describe("conductorPorCodigo", () => {
  it("ubica la ficha por el código de 6 caracteres, sin importar mayúsculas ni espacios", () => {
    expect(conductorPorCodigo([manuelViejo, manuelNuevo], "43c32f")?.id).toBe(manuelNuevo.id);
    expect(conductorPorCodigo([manuelViejo, manuelNuevo], " 43C32F ")?.id).toBe(manuelNuevo.id);
  });

  it("también por el id completo o por el userId", () => {
    expect(coincideConductor(manuelNuevo, manuelNuevo.id)).toBe(true);
    expect(coincideConductor({ id: "x", userId: "abcdef-123456" }, "123456")).toBe(true);
  });

  it("sin ficha en la lista devuelve null (y el portal la pide por id)", () => {
    expect(conductorPorCodigo([manuelViejo], "43c32f")).toBeNull();
    expect(conductorPorCodigo([manuelNuevo], "")).toBeNull();
    expect(coincideConductor({ id: null, userId: null }, "43c32f")).toBe(false);
  });
});
