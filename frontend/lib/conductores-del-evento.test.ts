import { describe, expect, it } from "vitest";
import { conductorEnEvento, proveedorEnEvento } from "./conductores-del-evento";

/**
 * 28-09-2026: con World Rugby creado, "Conductor llegada" de AND y el
 * conductor de Viajes seguían ofreciendo los 80 de los Juegos Escolares.
 */
const JDE = "evento-jde-2026";
const RUGBY = "evento-world-rugby-u20";

describe("conductorEnEvento", () => {
  // Conductor de BVAN: su proveedor trabaja en los dos eventos.
  const bvan = { id: "p-hector", fullName: "Héctor Silva", providerId: "bvan", eventIds: [JDE, RUGBY] };
  // Conductor de un proveedor que sólo está en los Juegos Escolares.
  const soloJde = { id: "p-ana", fullName: "Ana Díaz", providerId: "transportes-sur", eventIds: [JDE] };
  // Flota propia (transport.drivers): trae su evento.
  const flota = { id: "d-luis", fullName: "Luis Rojas", source: "fleet", eventId: RUGBY };
  // Registro antiguo sin datos de evento: se conserva.
  const antiguo = { id: "p-marta", fullName: "Marta Soto", eventIds: [] as string[] };

  it("el de BVAN aparece en los dos eventos", () => {
    expect(conductorEnEvento(bvan, JDE)).toBe(true);
    expect(conductorEnEvento(bvan, RUGBY)).toBe(true);
  });
  it("el de un proveedor de los Juegos Escolares no aparece en World Rugby", () => {
    expect(conductorEnEvento(soloJde, JDE)).toBe(true);
    expect(conductorEnEvento(soloJde, RUGBY)).toBe(false);
  });
  it("la flota propia se ubica por su eventId", () => {
    expect(conductorEnEvento(flota, RUGBY)).toBe(true);
    expect(conductorEnEvento(flota, JDE)).toBe(false);
  });
  it("sin datos de evento se conserva", () => {
    expect(conductorEnEvento(antiguo, RUGBY)).toBe(true);
    expect(conductorEnEvento({ eventIds: null, eventId: null }, RUGBY)).toBe(true);
    expect(conductorEnEvento(undefined, RUGBY)).toBe(true);
  });
  it("sin evento activo no se filtra", () => {
    expect(conductorEnEvento(soloJde, "")).toBe(true);
    expect(conductorEnEvento(flota, null)).toBe(true);
  });
  it("eventIds manda sobre eventId", () => {
    expect(conductorEnEvento({ eventIds: [JDE], eventId: RUGBY }, RUGBY)).toBe(false);
  });
});

describe("proveedorEnEvento", () => {
  it("sólo los proveedores del evento; sin eventos vale para todos", () => {
    expect(proveedorEnEvento({ eventIds: [JDE, RUGBY] }, RUGBY)).toBe(true);
    expect(proveedorEnEvento({ eventIds: [JDE] }, RUGBY)).toBe(false);
    expect(proveedorEnEvento({ eventIds: [] }, RUGBY)).toBe(true);
    expect(proveedorEnEvento({}, RUGBY)).toBe(true);
    expect(proveedorEnEvento({ eventIds: [JDE] }, "")).toBe(true);
  });
});
