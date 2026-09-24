import { describe, expect, it } from "vitest";
import { historialDeJornada, jornadasDelHistorial, jornadaDeCierre } from "./historial-viajes";

/**
 * Historial por jornada (23-09-2026): con el evento andando, el historial
 * era una sola lista sin orden claro y no había cómo mirar sólo los viajes
 * de ayer.
 */
const viajes = [
  { id: "a", scheduledAt: "2026-09-23T10:00:00-03:00", completedAt: "2026-09-23T11:05:00-03:00" },
  { id: "b", scheduledAt: "2026-09-22T18:00:00-03:00", completedAt: "2026-09-22T19:20:00-03:00" },
  { id: "c", scheduledAt: "2026-09-22T07:30:00-03:00", completedAt: "2026-09-22T08:40:00-03:00" },
  // Programado a las 23:30 de Chile: en UTC ya es el 23, pero la jornada es el 22.
  { id: "d", scheduledAt: "2026-09-22T23:30:00-03:00", completedAt: "2026-09-23T00:10:00-03:00" },
  { id: "e", scheduledAt: null, completedAt: null, updatedAt: null },
];

describe("jornadaDeCierre", () => {
  it("es el día programado en hora de Chile, aunque en UTC sea el siguiente", () => {
    expect(jornadaDeCierre(viajes[3])).toBe("2026-09-22");
  });
  it("sin ninguna fecha cae en 'sin-fecha'", () => {
    expect(jornadaDeCierre(viajes[4])).toBe("sin-fecha");
  });
});

describe("jornadasDelHistorial", () => {
  it("lista las jornadas de la más reciente a la más antigua, con su cuenta, y 'sin fecha' al final", () => {
    expect(jornadasDelHistorial(viajes)).toEqual([
      { key: "2026-09-23", count: 1 },
      { key: "2026-09-22", count: 3 },
      { key: "sin-fecha", count: 1 },
    ]);
  });
});

describe("historialDeJornada", () => {
  it("deja sólo los del día pedido, del cierre más reciente al más antiguo", () => {
    expect(historialDeJornada(viajes, "2026-09-22").map((v) => v.id)).toEqual(["d", "b", "c"]);
  });
  it("con jornada vacía devuelve todos, ordenados por cierre", () => {
    expect(historialDeJornada(viajes, "").map((v) => v.id)).toEqual(["a", "d", "b", "c", "e"]);
  });
  it("no altera la lista original", () => {
    const copia = [...viajes];
    historialDeJornada(viajes, "");
    expect(viajes).toEqual(copia);
  });
});
