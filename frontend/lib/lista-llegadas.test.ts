import { describe, expect, it } from "vitest";
import { masRecientePrimero, recortarPasajeros } from "./lista-llegadas";

/**
 * 17-10-2026: el LA715 de México trae 12 pasajeros en un solo traslado; la
 * fila muestra cinco y el resto va a una ventana. La lista se ordena del
 * traslado más reciente al más antiguo.
 */
describe("lista del Monitoreo de Llegadas", () => {
  const doce = Array.from({ length: 12 }, (_, i) => `Pasajero ${i + 1}`);

  it("muestra hasta cinco nombres y cuenta los que faltan", () => {
    expect(recortarPasajeros(doce)).toEqual({ visibles: doce.slice(0, 5), restantes: 7 });
    expect(recortarPasajeros(doce.slice(0, 5))).toEqual({ visibles: doce.slice(0, 5), restantes: 0 });
    expect(recortarPasajeros([])).toEqual({ visibles: [], restantes: 0 });
  });

  it("ordena del más reciente al más antiguo, los sin hora al final", () => {
    const lista = [
      { id: "brasil", scheduledAt: "2026-09-30T12:00:00.000Z" },
      { id: "sin-hora", scheduledAt: null },
      { id: "mexico", scheduledAt: "2026-10-15T14:30:00.000Z" },
      { id: "mexico-temprano", scheduledAt: "2026-10-15T08:45:00.000Z" },
    ];
    expect([...lista].sort(masRecientePrimero).map((v) => v.id)).toEqual(["mexico", "mexico-temprano", "brasil", "sin-hora"]);
  });
});
