import { describe, expect, it } from "vitest";
import { cumpleFiltroAnd, fechaHoraCorta, fichaValidada, tieneLlegada, tieneSalida } from "./and-listado";

/**
 * 28-09-2026: AND no mostraba ninguna ficha con vuelo de World Rugby: sólo
 * listaba participantes validados y los 23 cargados por la planilla estaban
 * "Registrados". Datos de un juez cargado ese día.
 */
const SERGIO = {
  participantStatus: "REGISTERED",
  participantMetadata: { gender: "Masculino" },
  participantFullName: "SERGIO ALVARENGA",
  participantTripType: "",
  participantFlightNumber: "LA1324",
  participantArrivalTime: "2026-09-28T14:15",
  participantDepartureFlightNumber: "LA1325",
  participantDepartureTime: "2026-10-18T15:05",
};
const COORDINADORA = {
  participantStatus: "PERSONAL_DATA_VALIDATED",
  participantMetadata: { personalDataValidated: true },
  participantFullName: "Claribel Fonseca",
};

describe("listado de AND", () => {
  it("se ve la ficha sin validar (el caso de Rugby)", () => {
    expect(cumpleFiltroAnd(SERGIO, {})).toBe(true);
    expect(fichaValidada(SERGIO)).toBe(false);
  });

  it("el estado se lee de la ficha, no sólo de la marca de la metadata", () => {
    expect(fichaValidada({ participantStatus: "PERSONAL_DATA_VALIDATED", participantMetadata: {} })).toBe(true);
    expect(fichaValidada(COORDINADORA)).toBe(true);
  });

  it("filtro de estado: validados y sin validar", () => {
    expect(cumpleFiltroAnd(SERGIO, { estado: "PENDIENTE" })).toBe(true);
    expect(cumpleFiltroAnd(SERGIO, { estado: "VALIDADO" })).toBe(false);
    expect(cumpleFiltroAnd(COORDINADORA, { estado: "VALIDADO" })).toBe(true);
  });

  it("una ficha con llegada y salida cuenta en las dos, aunque no tenga tipo de viaje", () => {
    expect(tieneLlegada(SERGIO)).toBe(true);
    expect(tieneSalida(SERGIO)).toBe(true);
    expect(cumpleFiltroAnd(SERGIO, { sentido: "ARRIVAL" })).toBe(true);
    expect(cumpleFiltroAnd(SERGIO, { sentido: "DEPARTURE" })).toBe(true);
    expect(cumpleFiltroAnd(COORDINADORA, { sentido: "ARRIVAL" })).toBe(false);
  });

  it("con tipo de viaje elegido manda el tipo", () => {
    expect(tieneSalida({ ...SERGIO, participantTripType: "ARRIVAL" })).toBe(false);
    expect(tieneLlegada({ ...SERGIO, participantTripType: "DEPARTURE" })).toBe(false);
  });

  it("una ficha dada de baja no aparece", () => {
    expect(cumpleFiltroAnd({ ...SERGIO, participantStatus: "DELETED" }, {})).toBe(false);
  });

  it("búsqueda por nombre", () => {
    expect(cumpleFiltroAnd(SERGIO, { busqueda: "alvar" })).toBe(true);
    expect(cumpleFiltroAnd(SERGIO, { busqueda: "namibia" })).toBe(false);
  });

  it("fecha corta para la tarjeta", () => {
    expect(fechaHoraCorta("2026-09-28T14:15")).toBe("28-09 14:15");
    expect(fechaHoraCorta("")).toBe("");
  });
});
