import { describe, expect, it } from "vitest";
import { suavizado, valorAnimado } from "./contador-animado";

describe("contador animado", () => {
  it("el suavizado parte en 0, termina en 1 y frena al llegar", () => {
    expect(suavizado(0)).toBe(0);
    expect(suavizado(1)).toBe(1);
    expect(suavizado(0.5)).toBeGreaterThan(0.5);
    expect(suavizado(2)).toBe(1);
    expect(suavizado(-1)).toBe(0);
  });

  it("interpola entre el valor anterior y el nuevo", () => {
    expect(valorAnimado(0, 1000, 0)).toBe(0);
    expect(valorAnimado(0, 1000, 1)).toBe(1000);
    expect(valorAnimado(500, 1000, 0.5)).toBeGreaterThan(750);
    expect(valorAnimado(1000, 0, 1)).toBe(0);
  });
});
