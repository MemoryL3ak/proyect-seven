import { describe, expect, it } from "vitest";
import { nombresDePasajeros, pasajerosDe, trasladoPorPasajero } from "./traslado-por-pasajero";

/**
 * 16-10-2026: los 12 de México que llegaron en el LA715 van en UN traslado;
 * sólo uno figura como solicitante y los demás como pasajeros. El Monitoreo
 * de Salidas buscaba el viaje de cada persona por el solicitante.
 */
describe("traslado por pasajero", () => {
  const grupo = { id: "grupo", requesterAthleteId: "ana", athleteIds: ["ana", "beto", "carla"] };
  const solo = { id: "solo", requesterAthleteId: "dani", athleteIds: [] };
  const sinSolicitante = { id: "planilla", requesterAthleteId: null, athleteIds: ["eli"] };

  it("junta al solicitante con los pasajeros, sin repetir", () => {
    expect(pasajerosDe(grupo)).toEqual(["ana", "beto", "carla"]);
    expect(pasajerosDe(solo)).toEqual(["dani"]);
    expect(pasajerosDe(sinSolicitante)).toEqual(["eli"]);
    expect(pasajerosDe({})).toEqual([]);
  });

  it("cada persona del grupo encuentra el mismo viaje", () => {
    const mapa = trasladoPorPasajero([grupo, solo, sinSolicitante]);
    expect(mapa.get("ana")?.id).toBe("grupo");
    expect(mapa.get("beto")?.id).toBe("grupo");
    expect(mapa.get("carla")?.id).toBe("grupo");
    expect(mapa.get("dani")?.id).toBe("solo");
    expect(mapa.get("eli")?.id).toBe("planilla");
    expect(mapa.has("nadie")).toBe(false);
  });

  it("los nombres salen de la nómina y, si falta alguien, de los que trae el viaje", () => {
    const nomina: Record<string, string> = { ana: "Ana Pérez", beto: "Beto Soto" };
    const viaje = { ...grupo, athleteNames: ["Ana P.", "Beto S.", "Carla Ruiz"] };
    expect(nombresDePasajeros(viaje, (id) => nomina[id])).toEqual(["Ana Pérez", "Beto Soto", "Carla Ruiz"]);
    expect(nombresDePasajeros(solo, () => null)).toEqual([]);
  });

  it("con dos viajes de la misma persona manda el primero de la lista", () => {
    const mapa = trasladoPorPasajero([{ id: "primero", requesterAthleteId: "ana" }, grupo]);
    expect(mapa.get("ana")?.id).toBe("primero");
    expect(mapa.get("beto")?.id).toBe("grupo");
  });
});
