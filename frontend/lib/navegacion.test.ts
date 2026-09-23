import { describe, expect, it } from "vitest";
import { destinoDeNavegacion, enlacesDeNavegacion } from "./navegacion";

const catalogos = {
  venues: [{ id: "v1", name: "Polideportivo Viña del Mar", address: "Av. Padre Hurtado 300, Viña del Mar" }],
  hoteles: [{ id: "h1", name: "Hotel Diego de Almagro", address: "1 Norte 221, Viña del Mar" }],
  comedores: [{ id: "c1", name: "Comedor LRH (EX GALA)", address: "Arlegui 273, Viña del Mar" }],
};

describe("destinoDeNavegacion", () => {
  it("un hotel se navega por su dirección registrada, no por el nombre (hay Diego de Almagro en varias ciudades)", () => {
    const d = destinoDeNavegacion({ destination: "Hotel Diego de Almagro", destinationHotelId: "h1" }, "dropoff", catalogos);
    expect(d).toEqual({ consulta: "1 Norte 221, Viña del Mar", etiqueta: "Hotel Diego de Almagro", fuente: "direccion" });
    expect(enlacesDeNavegacion(d!).waze).toBe("https://waze.com/ul?q=1%20Norte%20221%2C%20Vi%C3%B1a%20del%20Mar&navigate=yes");
    expect(enlacesDeNavegacion(d!).gmaps).toContain("destination=1%20Norte%20221");
  });

  it("un comedor con nombre interno también va por dirección", () => {
    expect(destinoDeNavegacion({ origin: "Comedor LRH (EX GALA)", originFoodLocationId: "c1" }, "pickup", catalogos)?.consulta)
      .toBe("Arlegui 273, Viña del Mar");
  });

  it("aunque el texto del viaje sea otro, manda la sede a la que apunta el id", () => {
    const d = destinoDeNavegacion({ destination: "Av. Padre Hurtado 300", destinationVenueId: "v1" }, "dropoff", catalogos);
    expect(d?.etiqueta).toBe("Polideportivo Viña del Mar");
    expect(d?.consulta).toBe("Av. Padre Hurtado 300, Viña del Mar");
  });

  it("al ir a recoger, la posición del pasajero manda sobre todo lo demás", () => {
    const d = destinoDeNavegacion({ origin: "Hotel Ankara", originHotelId: "h1", passengerLat: -33.02, passengerLng: -71.55 }, "pickup", catalogos);
    expect(d).toEqual({ consulta: "-33.02,-71.55", etiqueta: "Hotel Ankara", fuente: "coordenadas" });
    expect(enlacesDeNavegacion(d!).waze).toBe("https://waze.com/ul?ll=-33.02,-71.55&navigate=yes");
  });

  it("sin lugar del catálogo queda el texto escrito, y sin nada no hay destino", () => {
    expect(destinoDeNavegacion({ destination: "Magic hotel" }, "dropoff", catalogos)).toEqual({ consulta: "Magic hotel", etiqueta: "Magic hotel", fuente: "texto" });
    expect(destinoDeNavegacion({ destination: "Magic hotel", destinationHotelId: "no-existe" }, "dropoff", catalogos)?.fuente).toBe("texto");
    expect(destinoDeNavegacion({}, "dropoff", catalogos)).toBeNull();
  });
});
