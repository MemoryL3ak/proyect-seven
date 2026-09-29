import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buscadorDeFichas } from "./ficha-existente";
import { hotelDeTexto } from "./hotel-por-texto";

/**
 * 29-09-2026, Rugby: "subo la planilla y en viajes y al conductor no está
 * tomando el destino". El hotel de la planilla no calzaba con el nombre exacto
 * del sistema y se descartaba callado (traslados a "Hotel por confirmar"); y
 * volver a subirla duplicó 7 fichas sin pasaporte ni correo.
 */
const RUGBY = "8bbd6a39-a788-4588-9c15-7aec86080dba";
const JDE = "0e168c10-a7d1-47ae-9784-265a5fc25d9d";
const hoteles = [
  { id: "sheraton", name: "Hotel Sheraton Santiago", eventId: RUGBY },
  { id: "torremayor", name: "Hotel Torremayor", eventId: RUGBY },
  { id: "mantagua", name: "Mantagua Village", eventId: JDE },
];

describe("hotel de la planilla", () => {
  it("reconoce el hotel aunque venga escrito distinto", () => {
    expect(hotelDeTexto("Sheraton", hoteles, RUGBY)).toEqual({ hotel: hoteles[0] });
    expect(hotelDeTexto("HOTEL SHERATON", hoteles, RUGBY)).toEqual({ hotel: hoteles[0] });
    expect(hotelDeTexto("Hotel Sheraton Santiago", hoteles, RUGBY)).toEqual({ hotel: hoteles[0] });
    expect(hotelDeTexto("Torre Mayor", hoteles, RUGBY)).toEqual({ hotel: hoteles[1] });
    expect(hotelDeTexto("torremayor providencia", hoteles, RUGBY)).toEqual({ hotel: hoteles[1] });
  });

  it("uno que no existe en el evento se avisa con los hoteles que sí hay", () => {
    expect(hotelDeTexto("Hilton", hoteles, RUGBY)).toEqual({
      error: 'Hotel "Hilton" no existe en este evento. Hoteles del evento: Hotel Sheraton Santiago, Hotel Torremayor.',
    });
    // Mantagua es de los Juegos Escolares, no de Rugby
    expect(hotelDeTexto("Mantagua", hoteles, RUGBY)).toHaveProperty("error");
  });

  it("celda vacía no es error: el hotel se asigna después", () => {
    expect(hotelDeTexto("", hoteles, RUGBY)).toBeNull();
  });
});

describe("persona que ya tiene ficha", () => {
  const fichas = [
    { id: "portugal-anoche", eventId: RUGBY, fullName: "Delegación Portugal", createdAt: "2026-09-29T01:01:24Z" },
    { id: "montes", eventId: RUGBY, fullName: "Joaquin Montes", createdAt: "2026-09-29T01:01:20Z" },
    { id: "montes-jde", eventId: JDE, fullName: "Joaquin Montes", createdAt: "2026-09-20T00:00:00Z" },
    { id: "con-pasaporte", eventId: RUGBY, fullName: "Ana Pérez", passportNumber: "P123", createdAt: "2026-09-28T00:00:00Z" },
  ];

  it("sin pasaporte ni correo se encuentra por nombre dentro del evento (no se duplica)", () => {
    const { buscar } = buscadorDeFichas(fichas);
    expect(buscar({ eventId: RUGBY, nombre: "Delegación Portugal" })?.id).toBe("portugal-anoche");
    expect(buscar({ eventId: RUGBY, nombre: "  delegacion   PORTUGAL " })?.id).toBe("portugal-anoche");
    expect(buscar({ eventId: RUGBY, nombre: "Joaquin Montes" })?.id).toBe("montes");
    expect(buscar({ eventId: JDE, nombre: "Joaquin Montes" })?.id).toBe("montes-jde");
  });

  it("mismo nombre con otro pasaporte es otra persona; sin pasaporte en la ficha, es la misma", () => {
    const { buscar } = buscadorDeFichas(fichas);
    expect(buscar({ eventId: RUGBY, nombre: "Ana Pérez", pasaporte: "X999" })).toBeUndefined();
    expect(buscar({ eventId: RUGBY, nombre: "Ana Pérez", pasaporte: "p123" })?.id).toBe("con-pasaporte");
    expect(buscar({ eventId: RUGBY, nombre: "Joaquin Montes", pasaporte: "AR555" })?.id).toBe("montes");
  });

  it("si ya hay dos con el mismo nombre, usa la más reciente en vez de crear una tercera", () => {
    const { buscar } = buscadorDeFichas([
      ...fichas,
      { id: "portugal-hoy", eventId: RUGBY, fullName: "Delegación Portugal", createdAt: "2026-09-29T16:55:36Z" },
    ]);
    expect(buscar({ eventId: RUGBY, nombre: "Delegación Portugal" })?.id).toBe("portugal-hoy");
  });

  it("la carga usa ambas búsquedas, y el hotel se valida antes de importar", () => {
    const panel = readFileSync(join(__dirname, "..", "components", "BulkImportPanel.tsx"), "utf8");
    expect(panel).toContain("const fichas = buscadorDeFichas(athletes || []);");
    expect(panel).toContain('if (hotel && "error" in hotel) nextErrors.push({ row: rowNumber, field: "hotel_name", message: hotel.error });');
    expect(panel).toContain('if (hotel && "hotel" in hotel) payload.hotelAccommodationId = hotel.hotel.id;');
    expect(panel).not.toContain("accommodationByKey.get(`${eventId}::${row.hotel_name.toLowerCase()}`)");
  });
});
