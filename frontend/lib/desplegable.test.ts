import { describe, expect, it } from "vitest";
import { altoEstimadoDeLista, direccionDeLista } from "./desplegable";

describe("dirección del desplegable", () => {
  it("en la barra flotante al pie de Viajes (poco espacio abajo) la lista se abre hacia arriba", () => {
    // 6 opciones ≈ 218 px; abajo quedan 60 px y arriba 800.
    const alto = altoEstimadoDeLista(6);
    expect(alto).toBe(6 * 36 + 2);
    expect(direccionDeLista(60, 800, alto)).toBe("arriba");
  });

  it("con espacio abajo se abre hacia abajo, como siempre", () => {
    expect(direccionDeLista(400, 100, altoEstimadoDeLista(6))).toBe("abajo");
  });

  it("si no cabe en ningún lado, va donde hay más espacio", () => {
    expect(direccionDeLista(100, 150, 320)).toBe("arriba");
    expect(direccionDeLista(150, 100, 320)).toBe("abajo");
    expect(altoEstimadoDeLista(40)).toBe(320);
  });
});
