import { describe, expect, it } from "vitest";
import {
  esTramoDisperso,
  metrosDeTrazado,
  puntosDeReferencia,
  saltoMaximo,
  ventanas,
} from "./ruta-realizada";

// Viña del Mar → Reñaca → Concón, como el viaje que se veía en rectas.
const vina = { lat: -33.0245, lng: -71.5518 };
const renaca = { lat: -32.9686, lng: -71.5457 };
const concon = { lat: -32.9264, lng: -71.5213 };

describe("esTramoDisperso", () => {
  it("tres fijos a kilómetros entre sí son un tramo disperso: hay que pedir la ruta por calles", () => {
    expect(saltoMaximo([vina, renaca, concon])).toBeGreaterThan(5000);
    expect(esTramoDisperso([vina, renaca, concon])).toBe(true);
  });

  it("fijos cada pocos metros no lo son: basta ajustarlos a la calle", () => {
    const seguidos = Array.from({ length: 20 }, (_, i) => ({ lat: vina.lat + i * 0.0005, lng: vina.lng }));
    expect(saltoMaximo(seguidos)).toBeLessThan(100);
    expect(esTramoDisperso(seguidos)).toBe(false);
  });
});

describe("puntosDeReferencia", () => {
  it("reparte hasta el máximo conservando el primero y el último", () => {
    const pts = Array.from({ length: 200 }, (_, i) => ({ lat: i, lng: 0 }));
    const ref = puntosDeReferencia(pts, 25);
    expect(ref).toHaveLength(25);
    expect(ref[0]).toEqual(pts[0]);
    expect(ref[24]).toEqual(pts[199]);
    // Parejo: los saltos entre referencias son casi iguales.
    const saltos = ref.slice(1).map((p, i) => p.lat - ref[i].lat);
    expect(Math.max(...saltos) - Math.min(...saltos)).toBeLessThanOrEqual(1);
  });

  it("con menos puntos que el máximo devuelve todos", () => {
    expect(puntosDeReferencia([vina, renaca, concon], 25)).toEqual([vina, renaca, concon]);
  });
});

describe("ventanas", () => {
  it("parte en ventanas que comparten el punto de unión, para que no queden huecos", () => {
    const pts = Array.from({ length: 250 }, (_, i) => i);
    const v = ventanas(pts, 100);
    expect(v.map((w) => w.length)).toEqual([100, 100, 52]);
    expect(v[0][99]).toBe(v[1][0]);
    expect(v[1][99]).toBe(v[2][0]);
    expect(v[2][51]).toBe(249);
  });

  it("un tramo corto es una sola ventana", () => {
    expect(ventanas([1, 2, 3], 100)).toEqual([[1, 2, 3]]);
  });
});

describe("metrosDeTrazado", () => {
  it("suma los tramos rectos", () => {
    const m = metrosDeTrazado([vina, renaca, concon]);
    expect(m).toBeGreaterThan(10_000);
    expect(m).toBeLessThan(13_000);
  });
});
