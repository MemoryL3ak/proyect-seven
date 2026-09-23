import { describe, expect, it } from "vitest";
import { TANDA_LISTA, tramoVisible } from "./lista-por-tandas";

/**
 * El 23-09-2026 la lista de Actividades de la app cortaba en 50 y el aviso
 * "Se muestran los 50 más próximos" no cargaba nada al tocarlo. Estas pruebas
 * fijan que cada tanda pedida suma 50 más hasta agotar la lista.
 */
describe("tramoVisible", () => {
  it("con una tanda muestra 50 y avisa cuántos faltan", () => {
    expect(tramoVisible(137, 1)).toEqual({ mostrados: 50, restantes: 87, proximaTanda: 50 });
  });

  it("cada tanda pedida suma 50 más", () => {
    expect(tramoVisible(137, 2)).toEqual({ mostrados: 100, restantes: 37, proximaTanda: 37 });
    expect(tramoVisible(137, 3)).toEqual({ mostrados: 137, restantes: 0, proximaTanda: 0 });
  });

  it("una lista corta se muestra entera y no ofrece más", () => {
    expect(tramoVisible(12, 1)).toEqual({ mostrados: 12, restantes: 0, proximaTanda: 0 });
    expect(tramoVisible(0, 1)).toEqual({ mostrados: 0, restantes: 0, proximaTanda: 0 });
  });

  it("exactamente 50 no deja un botón que no trae nada", () => {
    expect(tramoVisible(TANDA_LISTA, 1).restantes).toBe(0);
  });

  it("tandas inválidas cuentan como una", () => {
    expect(tramoVisible(80, 0).mostrados).toBe(50);
    expect(tramoVisible(80, -3).mostrados).toBe(50);
  });
});
