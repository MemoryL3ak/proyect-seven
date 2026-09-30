import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { destinoDeNavegacion, esLugarPorConfirmar } from "./navegacion";

/**
 * 30-09-2026, Rugby: "le puse recogí al pasajero y me mandó a una dirección
 * en San Antonio". El viaje de las 09:00 (Polideportivo Estadio Nacional →
 * "x confirmar") mandaba ese texto a Waze/Google como si fuera un lugar.
 */
describe("destino por confirmar", () => {
  it("reconoce los textos de la planilla que no son un lugar", () => {
    for (const t of ["x confirmar", "X Confirmar", "Por confirmar", "a confirmar", "Hotel por confirmar", "Sede por definir", "TBD", "Pendiente"]) {
      expect(esLugarPorConfirmar(t)).toBe(true);
    }
    for (const t of ["Polideportivo Estadio Nacional", "Hotel Sheraton", "Av. Sta. María 1742", "Confirmar 123", ""]) {
      expect(esLugarPorConfirmar(t)).toBe(false);
    }
  });

  it("con el pasajero a bordo no se navega a 'x confirmar'", () => {
    const viaje = { origin: "Polideportivo Estadio Nacional", destination: "x confirmar" };
    expect(destinoDeNavegacion(viaje, "dropoff", {})).toBeNull();
    // un lugar del catálogo sí se navega aunque el texto diga otra cosa
    const conSede = { ...viaje, destinationVenueId: "v1" };
    expect(destinoDeNavegacion(conSede, "dropoff", { venues: [{ id: "v1", name: "Polideportivo", address: "Av. Pedro de Valdivia 4801, Ñuñoa" }] })?.consulta)
      .toBe("Av. Pedro de Valdivia 4801, Ñuñoa");
  });

  it("el mapa no lo busca y la app del conductor avisa en vez de mandar a Waze", () => {
    const mapa = readFileSync(join(__dirname, "..", "components", "TripMap.tsx"), "utf8");
    expect(mapa).toContain("destination: esLugarPorConfirmar(entrada.destination) ? null : entrada.destination,");
    const app = readFileSync(join(__dirname, "..", "app", "portal", "conductor", "page.tsx"), "utf8");
    expect(app).toContain('{fase === "pickup" ? "Punto de recogida por confirmar" : "Destino por confirmar"}');
  });
});
