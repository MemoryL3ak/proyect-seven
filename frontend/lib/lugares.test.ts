import { describe, expect, it } from "vitest";
import { lugarDeExtremo, lugaresDeViajes, tocaLugar } from "./lugares";

/**
 * La planilla a veces trae la dirección en la celda del lugar, y la carga
 * igual deja el viaje apuntando a la sede por id. Estas pruebas fijan que el
 * nombre del catálogo manda sobre ese texto: si vuelve a mandar el texto, el
 * filtro de sede lista la dirección como un lugar aparte mientras la fila
 * muestra la sede, que fue el error que se corrigió.
 */
const catalogo: Record<string, string> = {
  "sede-naval": "Escuela Naval Arturo Prat",
  "hotel-hippo": "Hippocampus Concón Resort & Club",
};
const nombreDe = (id: string) => catalogo[id];

const conDireccion = {
  origin: "Hotel Hippocampus",
  originHotelId: "hotel-hippo",
  destination: "Fco. González de Hontaneda 11, Playa Ancha, Valparaíso",
  destinationVenueId: "sede-naval",
};
const conNombre = {
  origin: "Hotel Hippocampus",
  originHotelId: "hotel-hippo",
  destination: "Escuela Naval Arturo Prat",
  destinationVenueId: "sede-naval",
};
const sinVinculo = { origin: "Aeropuerto", destination: "Escuela Naval Arturo Prat" };

describe("lugarDeExtremo", () => {
  it("prefiere el nombre del catálogo al texto del viaje", () => {
    expect(lugarDeExtremo(conDireccion, "destination", nombreDe)).toBe("Escuela Naval Arturo Prat");
    expect(lugarDeExtremo(conDireccion, "origin", nombreDe)).toBe("Hippocampus Concón Resort & Club");
  });

  it("cae al texto cuando el viaje no apunta a ningún lugar", () => {
    expect(lugarDeExtremo(sinVinculo, "origin", nombreDe)).toBe("Aeropuerto");
    expect(lugarDeExtremo(sinVinculo, "destination", nombreDe)).toBe("Escuela Naval Arturo Prat");
  });

  it("cae al texto cuando el id no está en el catálogo", () => {
    expect(lugarDeExtremo(conDireccion, "destination", () => undefined)).toBe(conDireccion.destination);
  });
});

describe("lugaresDeViajes", () => {
  it("agrupa bajo la misma sede los viajes que traen dirección y los que traen nombre", () => {
    const lugares = lugaresDeViajes([conDireccion, conNombre, sinVinculo], [{ id: "hotel-hippo", name: catalogo["hotel-hippo"] }], nombreDe);
    const sedes = lugares.filter((l) => !l.esHotel);
    expect(sedes.map((l) => [l.texto, l.total])).toEqual([
      ["Aeropuerto", 1],
      ["Escuela Naval Arturo Prat", 3],
    ]);
    expect(lugares.filter((l) => l.esHotel).map((l) => [l.texto, l.total])).toEqual([
      ["Hippocampus Concón Resort & Club", 2],
    ]);
  });
});

describe("tocaLugar", () => {
  it("filtra con el mismo nombre que ofrece el desplegable", () => {
    expect(tocaLugar(conDireccion, "Escuela Naval Arturo Prat", nombreDe)).toBe(true);
    expect(tocaLugar(conDireccion, "Fco. González de Hontaneda 11, Playa Ancha, Valparaíso", nombreDe)).toBe(false);
    expect(tocaLugar(sinVinculo, "escuela naval arturo prat", nombreDe)).toBe(true);
  });
});
