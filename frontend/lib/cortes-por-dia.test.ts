import { describe, expect, it } from "vitest";
import { contarPorDia, empiezaDia } from "./cortes-por-dia";

/**
 * 28-09-2026: "no están por orden de horarios". Los viajes de Rugby sí iban
 * por hora, pero sin la fecha: 21:40 del 29-09 y luego 13:05 del 30-09.
 */
const viajes = [
  { id: "a", dia: "2026-09-29", hora: "21:40" },
  { id: "b", dia: "2026-09-29", hora: "23:39" },
  { id: "c", dia: "2026-09-30", hora: "13:05" },
  { id: "d", dia: "2026-09-30", hora: "15:05" },
];
const dia = (v: { dia: string }) => v.dia;

describe("encabezado de día en Viajes", () => {
  it("marca dónde empieza cada día", () => {
    expect(viajes.map((_, i) => empiezaDia(viajes, i, dia))).toEqual([true, false, true, false]);
  });

  it("cuenta los viajes de cada día en la lista completa", () => {
    expect(contarPorDia(viajes, dia)).toEqual(new Map([["2026-09-29", 2], ["2026-09-30", 2]]));
  });
});
