import { describe, expect, it } from "vitest";
import { columnasConductor, conductorPorTexto, sinConductor } from "./conductor-por-texto";

/**
 * 28-09-2026: la carga masiva de AND traía los vuelos pero no el chofer.
 * Ahora la planilla trae "conductor_llegada" / "conductor_salida" por nombre,
 * RUT o teléfono, buscados sólo entre los conductores del evento.
 */
const RUGBY = "rugby";
const JDE = "jde";
const CONDUCTORES = [
  { id: "hector", fullName: "Héctor Silva", rut: "12.345.678-5", phone: "998129760", eventIds: [JDE, RUGBY] },
  { id: "patricia", fullName: "Patricia Contreras", rut: "9.876.543-2", phone: "+56 9 1111 2222", eventIds: [RUGBY] },
  { id: "patricio", fullName: "Patricio Contreras", rut: "15.111.222-3", phone: "933334444", eventIds: [RUGBY] },
  { id: "solo-jde", fullName: "Alex Arevalo", rut: "13.200.254-1", phone: "955556666", eventIds: [JDE] },
];

describe("conductorPorTexto", () => {
  it("por nombre, sin importar tildes ni mayúsculas", () => {
    expect(conductorPorTexto("hector silva", CONDUCTORES, RUGBY)).toEqual({ id: "hector", nombre: "Héctor Silva" });
  });
  it("por RUT, con o sin puntos", () => {
    expect(conductorPorTexto("98765432", CONDUCTORES, RUGBY)).toEqual({ id: "patricia", nombre: "Patricia Contreras" });
    expect(conductorPorTexto("9.876.543-2", CONDUCTORES, RUGBY)).toMatchObject({ id: "patricia" });
  });
  it("por teléfono, con o sin +56", () => {
    expect(conductorPorTexto("+56 9 9812 9760", CONDUCTORES, RUGBY)).toMatchObject({ id: "hector" });
    expect(conductorPorTexto("911112222", CONDUCTORES, RUGBY)).toMatchObject({ id: "patricia" });
  });
  it("por parte del nombre si calza con uno solo", () => {
    expect(conductorPorTexto("Patricia", CONDUCTORES, RUGBY)).toMatchObject({ id: "patricia" });
  });
  it("si calza con varios, lo dice en vez de adivinar", () => {
    const r = conductorPorTexto("Contreras", CONDUCTORES, RUGBY);
    expect(r && "error" in r ? r.error : "").toMatch(/varios conductores/);
  });
  it("un conductor de otro evento no se asigna", () => {
    const r = conductorPorTexto("Alex Arevalo", CONDUCTORES, RUGBY);
    expect(r && "error" in r ? r.error : "").toMatch(/no es conductor de un proveedor de este evento/);
    expect(conductorPorTexto("Alex Arevalo", CONDUCTORES, JDE)).toMatchObject({ id: "solo-jde" });
  });
  it("celda vacía o '0' no es error: queda sin conductor", () => {
    expect(conductorPorTexto("", CONDUCTORES, RUGBY)).toBeNull();
    expect(conductorPorTexto("0", CONDUCTORES, RUGBY)).toBeNull();
    expect(sinConductor("Sin conductor")).toBe(true);
  });
});

describe("columnasConductor (itinerario oficial)", () => {
  it("encuentra las columnas por su título", () => {
    const filas = [["ITINERARIO"], ["País", "Nombre completo", "Pasaporte", "Conductor llegada", "Chofer Salida"]];
    expect(columnasConductor(filas)).toEqual({ llegada: 3, salida: 4 });
  });
  it("una sola columna 'Conductor' vale para llegada y salida", () => {
    expect(columnasConductor([[], ["País", "Nombre completo", "Conductor"]])).toEqual({ llegada: 2, salida: 2 });
  });
  it("sin columnas de conductor, nada", () => {
    expect(columnasConductor([[], ["País", "Nombre completo"]])).toEqual({ llegada: null, salida: null });
  });
});
