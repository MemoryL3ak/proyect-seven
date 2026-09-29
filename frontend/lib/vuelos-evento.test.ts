import { describe, expect, it } from "vitest";
import { agruparVuelos, conductoresDeVuelos, estadoTraslado, filtrarVuelos, SIN_CONDUCTOR_APP, soloProximos, type PasajeroVuelo } from "./vuelos-evento";

/** Lo que devolvía /flights/evento para World Rugby el 28-09-2026. */
const base: PasajeroVuelo = {
  id: "",
  nombre: null,
  pais: null,
  delegacion: null,
  vuelo_llegada: null,
  aerolinea_llegada: null,
  hora_llegada: null,
  origen: null,
  vuelo_salida: null,
  aerolinea_salida: null,
  hora_salida: null,
  traslado_llegada: null,
  conductor_llegada: null,
  traslado_salida: null,
  conductor_salida: null,
  recogida_salida: null,
};
const GINZO: PasajeroVuelo = { ...base, id: "ginzo", nombre: "FERNANDO GINZO", pais: "BRA", vuelo_llegada: "H2 1811", hora_llegada: "2026-09-28T00:50:00.000Z", traslado_llegada: "COMPLETED", conductor_llegada: "Carlos marcelo Hernández sepulveda", vuelo_salida: "LA410", hora_salida: "2026-10-04T19:03:00.000Z", traslado_salida: "SCHEDULED" };
const SERGIO: PasajeroVuelo = { ...base, id: "sergio", nombre: "SERGIO ALVARENGA", pais: "PRY", vuelo_llegada: "LA1324", hora_llegada: "2026-09-28T17:15:00.000Z", traslado_llegada: "DROPPED_OFF", vuelo_salida: "LA1325", hora_salida: "2026-10-18T18:05:00.000Z", traslado_salida: "SCHEDULED" };
const COMPANERO: PasajeroVuelo = { ...SERGIO, id: "otro", nombre: "OTRO JUEZ", vuelo_llegada: "la 1324", traslado_llegada: "SCHEDULED" };
const AHORA = new Date("2026-09-28T19:00:00.000Z");

describe("vuelos del evento (app del Coordinador de Sede)", () => {
  it("agrupa las llegadas por vuelo y hora, en orden", () => {
    const grupos = agruparVuelos([SERGIO, GINZO, COMPANERO], "LLEGADA", AHORA);
    expect(grupos.map((g) => [g.vuelo, g.pasajeros.length])).toEqual([
      ["H2 1811", 1],
      ["LA1324", 2],
    ]);
    expect(grupos[0].estado).toBe("ARRIBADO");
  });

  it("cada pasajero con su traslado y su conductor", () => {
    const [ginzo] = agruparVuelos([GINZO], "LLEGADA", AHORA);
    expect(ginzo.pasajeros[0]).toMatchObject({ nombre: "FERNANDO GINZO", traslado: "REALIZADO", conductor: "Carlos marcelo Hernández sepulveda" });
  });

  it("las salidas usan el vuelo de salida", () => {
    const grupos = agruparVuelos([GINZO, SERGIO], "SALIDA", AHORA);
    expect(grupos.map((g) => g.vuelo)).toEqual(["LA410", "LA1325"]);
    expect(grupos[0].estado).toBe("PROGRAMADO");
    expect(grupos[0].pasajeros[0].traslado).toBe("PENDIENTE");
  });

  it("próximos: los de hoy y los que vienen, no los de días anteriores", () => {
    const grupos = agruparVuelos([GINZO, SERGIO], "LLEGADA", new Date("2026-09-29T15:00:00.000Z"));
    expect(soloProximos(grupos, new Date("2026-09-29T15:00:00.000Z"))).toEqual([]);
    // Ginzo aterrizó el 27-09 a las 21:50 de Chile (00:50 UTC del 28): el 28
    // ya no es "de hoy". Sergio (28-09 14:15) sí.
    expect(soloProximos(grupos, AHORA).map((g) => g.vuelo)).toEqual(["LA1324"]);
  });

  it("estado del traslado", () => {
    expect(estadoTraslado(null)).toBe("SIN_TRASLADO");
    expect(estadoTraslado("PICKED_UP")).toBe("EN_CURSO");
    expect(estadoTraslado("SCHEDULED")).toBe("PENDIENTE");
  });
});

/**
 * 28-09-2026: "crear filtros en ambos vuelos, y que nos aparezca en cada
 * vuelo la información del conductor". La app trae el teléfono y la patente
 * del conductor y filtra por traslado y conductor, como el panel.
 */
describe("vuelos de la app: conductor y filtros", () => {
  const GINZO_CON_DATOS: PasajeroVuelo = {
    ...GINZO,
    conductor_llegada_id: "carlos",
    telefono_conductor_llegada: "+56998241782",
    patente_llegada: "TRSB84",
  };

  it("cada pasajero trae el teléfono y la patente de su conductor", () => {
    const [grupo] = agruparVuelos([GINZO_CON_DATOS], "LLEGADA", AHORA);
    expect(grupo.pasajeros[0]).toMatchObject({ conductorId: "carlos", telefono: "+56998241782", patente: "TRSB84" });
  });

  it("filtra por conductor y por estado del traslado", () => {
    const grupos = agruparVuelos([SERGIO, GINZO_CON_DATOS, COMPANERO], "LLEGADA", AHORA);
    expect(conductoresDeVuelos(grupos)).toEqual([{ value: "carlos", label: "Carlos marcelo Hernández sepulveda" }]);
    expect(filtrarVuelos(grupos, { conductor: "carlos" }).map((g) => g.vuelo)).toEqual(["H2 1811"]);
    // Sergio y su compañero tienen traslado sin conductor.
    expect(filtrarVuelos(grupos, { conductor: SIN_CONDUCTOR_APP }).flatMap((g) => g.pasajeros.map((p) => p.id)).sort()).toEqual(["otro", "sergio"]);
    expect(filtrarVuelos(grupos, { traslado: "PENDIENTE" }).flatMap((g) => g.pasajeros.map((p) => p.id))).toEqual(["otro"]);
    expect(filtrarVuelos(grupos, {})).toBe(grupos);
  });
});
