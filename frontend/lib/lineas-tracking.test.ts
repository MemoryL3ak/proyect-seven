import { describe, expect, it } from "vitest";
import { baseDeRastro, lineasDelSeleccionado } from "./lineas-tracking";

const rutas = [{ tripId: "viaje-1" }, { tripId: "viaje-2" }];
const rastros = [
  { tripId: "viaje-1#0" },
  { tripId: "viaje-1#1" },
  { tripId: "viaje-2#0" },
  { tripId: "driver-x#0" },
];
const destinos = [{ tripId: "viaje-1" }, { tripId: "viaje-2" }];

describe("lineasDelSeleccionado", () => {
  it("sin selección el mapa no lleva ninguna línea", () => {
    expect(lineasDelSeleccionado(null, rutas, rastros, destinos)).toEqual({
      rutasEnMapa: [],
      rastrosEnMapa: [],
      destinosEnMapa: [],
    });
  });

  it("con un viaje elegido van su ruta, todos sus tramos de rastro y su destino", () => {
    expect(lineasDelSeleccionado("viaje-1", rutas, rastros, destinos)).toEqual({
      rutasEnMapa: [{ tripId: "viaje-1" }],
      rastrosEnMapa: [{ tripId: "viaje-1#0" }, { tripId: "viaje-1#1" }],
      destinosEnMapa: [{ tripId: "viaje-1" }],
    });
  });

  it("un conductor sin viaje también muestra su rastro", () => {
    expect(lineasDelSeleccionado("driver-x", rutas, rastros, destinos).rastrosEnMapa).toEqual([
      { tripId: "driver-x#0" },
    ]);
  });

  it("baseDeRastro quita el sufijo del tramo", () => {
    expect(baseDeRastro("viaje-1#3")).toBe("viaje-1");
    expect(baseDeRastro("viaje-1")).toBe("viaje-1");
  });
});
