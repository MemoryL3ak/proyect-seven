import { describe, expect, it } from "vitest";
import { cambioDeDestino, duracionDeTween } from "./mapa-animacion";

describe("cuándo volver a animar un pin", () => {
  it("sólo cuando el equipo mandó otra posición; a medio camino, con el mismo destino, no se reinicia", () => {
    const destino = { lat: -33.45, lng: -70.65 };
    expect(cambioDeDestino(undefined, destino)).toBe(true);
    expect(cambioDeDestino(destino, { lat: -33.45, lng: -70.65 })).toBe(false);
    expect(cambioDeDestino(destino, { lat: -33.4501, lng: -70.65 })).toBe(true);
    // Diferencias de redondeo no cuentan.
    expect(cambioDeDestino(destino, { lat: -33.45 + 1e-9, lng: -70.65 })).toBe(false);
  });
});

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
