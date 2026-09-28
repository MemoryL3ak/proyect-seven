import { describe, expect, it } from "vitest";
import { datosDelTramo, trasladosPorClave } from "./and-planilla";
import { claveDeColumna } from "./columnas-carga";
import { columnasExtraTraslado, conductorDelTramo, flotaDeTexto } from "./conductor-por-texto";

/**
 * 28-09-2026: "este es el template que se descarga desde AND, no veo que
 * tenga todos los campos que te pedí". La plantilla traía "Llegada ·
 * conductor" y "Salida · conductor", pero no el teléfono del conductor, la
 * patente ni el tipo de flota. Datos reales: Carlos (SUV Mazda CX5, TRSB84).
 */
const RUGBY = "rugby";
const CONDUCTORES = [
  {
    id: "carlos",
    fullName: "Carlos marcelo Hernández sepulveda",
    phone: "+56998241782",
    eventIds: [RUGBY],
    metadata: { vehiclePatente: "trsb84", vehicleTipo: "SUV" },
  },
  { id: "luis", fullName: "LUIS SOTO", phone: "+56 9 5555 1111", eventIds: [RUGBY], metadata: { vehiclePatente: "KLMN22" } },
  { id: "luisa", fullName: "Luisa Soto Pérez", phone: "912340000", eventIds: [RUGBY], metadata: {} },
];

describe("plantilla de AND: columnas del traslado", () => {
  it("la plantilla lee teléfono, patente y tipo de flota de cada tramo", () => {
    expect(claveDeColumna("Llegada · teléfono conductor")).toBe("telefono_conductor_llegada");
    expect(claveDeColumna("Llegada · patente")).toBe("patente_llegada");
    expect(claveDeColumna("Llegada · tipo de flota")).toBe("flota_llegada");
    expect(claveDeColumna("Salida · teléfono conductor")).toBe("telefono_conductor_salida");
    expect(claveDeColumna("Salida · patente")).toBe("patente_salida");
    expect(claveDeColumna("Salida · tipo de flota")).toBe("flota_salida");
  });
});

describe("conductorDelTramo", () => {
  it("sin nombre, el teléfono o la patente encuentran al conductor", () => {
    expect(conductorDelTramo({ telefono: "998241782" }, CONDUCTORES, RUGBY)).toEqual({
      id: "carlos",
      nombre: "Carlos marcelo Hernández sepulveda",
    });
    expect(conductorDelTramo({ patente: "TR-SB 84" }, CONDUCTORES, RUGBY)).toMatchObject({ id: "carlos" });
  });

  it("un nombre que calza con varios se resuelve con el teléfono", () => {
    expect(conductorDelTramo({ conductor: "Soto", telefono: "+56955551111" }, CONDUCTORES, RUGBY)).toMatchObject({
      id: "luis",
    });
  });

  it("avisa si el teléfono es de otro conductor", () => {
    const r = conductorDelTramo({ conductor: "Carlos Hernández", telefono: "955551111" }, CONDUCTORES, RUGBY);
    expect(r).toEqual({ error: expect.stringContaining("LUIS SOTO") });
  });

  it("un teléfono que no es de nadie del evento es un error, no se ignora", () => {
    expect(conductorDelTramo({ telefono: "911112222" }, CONDUCTORES, RUGBY)).toEqual({
      error: expect.stringContaining("911112222"),
    });
  });

  it("todo vacío: sin conductor, sin error", () => {
    expect(conductorDelTramo({ conductor: "", telefono: "", patente: "" }, CONDUCTORES, RUGBY)).toBeNull();
  });
});

describe("tipo de flota", () => {
  it("se guarda con el nombre que usa Viajes", () => {
    expect(flotaDeTexto("suv")).toBe("SUV");
    expect(flotaDeTexto("VAN_15")).toBe("Van 15-17");
    expect(flotaDeTexto("van 15-17")).toBe("Van 15-17");
    expect(flotaDeTexto("Bus 40 pax")).toBe("Bus 40 pax");
    expect(flotaDeTexto("")).toBeNull();
  });
});

describe("itinerario oficial con columnas agregadas", () => {
  it("encuentra teléfono del conductor, patente y flota por su título", () => {
    const filas = [
      ["ITINERARIO"],
      ["País", "Nombre completo", "Teléfono", "Conductor llegada", "Teléfono conductor llegada", "Patente llegada", "Tipo de flota"],
    ];
    expect(columnasExtraTraslado(filas)).toEqual({
      // "Teléfono" solo es el del pasajero.
      telefono: { llegada: 4, salida: null },
      patente: { llegada: 5, salida: null },
      flota: { llegada: 6, salida: 6 },
    });
  });
});

describe("planilla que se descarga", () => {
  it("usa la patente de la plantilla si Viajes no asignó vehículo", () => {
    const traslados = trasladosPorClave([
      { id: "t", driverId: "carlos", metadata: { andKey: "and:sergio:LLEGADA", andPatente: "ZZXX11" } },
    ]);
    const conductores = new Map(CONDUCTORES.map((c) => [c.id, c]));
    expect(datosDelTramo("sergio", "LLEGADA", null, traslados, conductores, new Map()).patente).toBe("ZZXX11");
  });
});
