import { describe, expect, it } from "vitest";
import { duracionDeTween } from "./mapa-animacion";

describe("duración del desplazamiento del pin", () => {
  it("el primer movimiento es corto; después dura lo que tardó en llegar el dato", () => {
    expect(duracionDeTween(10_000, undefined)).toBe(600);
    // Posiciones cada 2 s (GPS de vehículo): el pin tarda 2 s en llegar, sin quedarse quieto.
    expect(duracionDeTween(12_000, 10_000)).toBe(2000);
    // Cada 8 s (sondeo completo): 8 s de viaje parejo.
    expect(duracionDeTween(18_000, 10_000)).toBe(8000);
  });

  it("acota entre 0,6 y 8 s y tolera relojes raros", () => {
    expect(duracionDeTween(10_100, 10_000)).toBe(600);
    expect(duracionDeTween(70_000, 10_000)).toBe(8000);
    expect(duracionDeTween(10_000, 20_000)).toBe(600);
    expect(duracionDeTween(NaN, 10_000)).toBe(600);
  });
});
