import { describe, expect, it } from "vitest";
import { cuerpoReserva, errorDeReserva, type DatosReserva } from "./reserva-t1";

/**
 * 28-09-2026: Solicitudes T1/VIP no tenía "acciones para reservar": sólo
 * llegaban las pedidas desde la app. Operaciones reserva desde el panel.
 */
const AHORA = new Date("2026-09-29T12:00:00.000Z");
const base: DatosReserva = {
  eventoId: "rugby",
  solicitante: { id: "victor", userType: "T1", fullName: "Víctor González" },
  origen: { tipo: "HOTEL", id: "sheraton", nombre: "Hotel Sheraton Santiago" },
  destino: { tipo: "SEDE", id: "pwcc", nombre: "PWCC · Prince of Wales Country Club" },
  fechaHora: "2026-09-30T09:00",
  pasajeros: 2,
  vehiculo: "SUV",
  idaYVuelta: false,
  autor: "Benjamín Alarcón",
};

describe("reserva T1/VIP desde el panel", () => {
  it("sin conductor queda Pendiente, como la de la app", () => {
    const cuerpo = cuerpoReserva(base, AHORA);
    expect(cuerpo).toMatchObject({
      eventId: "rugby",
      requesterAthleteId: "victor",
      athleteIds: ["victor"],
      clientType: "T1",
      tripType: "VIAJE_IDA",
      status: "REQUESTED",
      originHotelId: "sheraton",
      destinationVenueId: "pwcc",
      requestedVehicleType: "SUV",
      passengerCount: 2,
    });
    expect(cuerpo.driverId).toBeUndefined();
  });

  it("con conductor queda Agendada", () => {
    expect(cuerpoReserva({ ...base, conductorId: "carlos" }, AHORA)).toMatchObject({ status: "SCHEDULED", driverId: "carlos" });
  });

  it("ida y vuelta: el regreso vuelve al origen", () => {
    const cuerpo = cuerpoReserva({ ...base, idaYVuelta: true, regreso: "2026-09-30T13:00" }, AHORA);
    expect(cuerpo).toMatchObject({
      tripType: "VIAJE_IDA_REGRESO",
      isRoundTrip: true,
      returnOrigin: "PWCC · Prince of Wales Country Club",
      returnDestination: "Hotel Sheraton Santiago",
    });
  });

  it("revisa el formulario antes de reservar", () => {
    expect(errorDeReserva(base)).toBeNull();
    expect(errorDeReserva({ ...base, solicitante: { id: "x", userType: "TA" } })).toMatch(/T1 o VIP/);
    expect(errorDeReserva({ ...base, fechaHora: "" })).toMatch(/fecha/);
    expect(errorDeReserva({ ...base, idaYVuelta: true, regreso: "2026-09-30T08:00" })).toMatch(/después/);
  });
});
