import { describe, expect, it } from "vitest";
import { motivoErrorIngreso } from "./error-ingreso";

const conStatus = (status: number) => Object.assign(new Error("x"), { status });

describe("motivo de un ingreso fallido al portal (15-10-2026: con la app trabada decía que el código no existía)", () => {
  it("el servidor rechazó el código: código inválido", () => {
    expect(motivoErrorIngreso(conStatus(401))).toBe("codigo");
    expect(motivoErrorIngreso(conStatus(404))).toBe("codigo");
    expect(motivoErrorIngreso(conStatus(400))).toBe("codigo");
  });

  it("sin señal, corte, tiempo agotado o error del servidor: conexión, no el código", () => {
    expect(motivoErrorIngreso(new TypeError("Failed to fetch"))).toBe("conexion");
    expect(motivoErrorIngreso(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe("conexion");
    expect(motivoErrorIngreso(conStatus(502))).toBe("conexion");
    expect(motivoErrorIngreso(undefined)).toBe("conexion");
  });
});
