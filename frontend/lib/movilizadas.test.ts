import { describe, expect, it } from "vitest";
import { personasMovilizadas } from "./movilizadas";

/**
 * El 23-09-2026 la ficha "Personas movilizadas" mostraba 6237 con 264 viajes
 * programados y ninguno activo: sumaba los pasajeros de todo el filtro. Estas
 * pruebas fijan que sólo cuentan los viajes que ya movieron gente.
 */
describe("personasMovilizadas", () => {
  it("no cuenta viajes en cola, programados ni asignados", () => {
    const viajes = [
      { status: "REQUESTED", passengerCount: 10 },
      { status: "SCHEDULED", passengerCount: 25 },
      { status: "ASSIGNED", passengerCount: 30 },
    ];
    expect(personasMovilizadas(viajes)).toBe(0);
  });

  it("suma los viajes con gente a bordo o ya entregada", () => {
    const viajes = [
      { status: "SCHEDULED", passengerCount: 25 },
      { status: "EN_ROUTE", passengerCount: 8 },
      { status: "PICKED_UP", passengerCount: 12 },
      { status: "DROPPED_OFF", passengerCount: 20 },
      { status: "COMPLETED", passengerCount: 5 },
    ];
    expect(personasMovilizadas(viajes)).toBe(37);
  });

  it("descarta los cancelados y tolera pasajeros sin dato", () => {
    const viajes = [
      { status: "CANCELLED", passengerCount: 40 },
      { status: "COMPLETED", passengerCount: null },
      { status: "COMPLETED" },
      { status: undefined, passengerCount: 9 },
    ];
    expect(personasMovilizadas(viajes)).toBe(0);
  });
});
