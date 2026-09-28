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

/* ─── Filtros, orden y agrupación por día (28-09-2026) ─── */
import { agruparPorDia, ordenarAnd, SIN_CONDUCTOR, valoresAnd } from "./and-listado";

const ALAN = {
  participantStatus: "REGISTERED",
  participantFullName: "ALAN GILPIN",
  countryCode: "GBR",
  participantUserType: "STAFF WR",
  participantFlightNumber: "AR1282",
  participantAirline: "Aerolíneas Argentinas",
  participantArrivalTime: "2026-10-01T14:45",
  participantArrivalDriverId: "hector",
  participantDepartureFlightNumber: "QF28",
  participantDepartureTime: "2026-10-04T13:10",
  participantMetadata: { departure: { airline: "Qantas" } },
};
const ARMEN = {
  participantStatus: "REGISTERED",
  participantFullName: "ARMEN ABI-SAAB",
  countryCode: "URY",
  participantUserType: "TF",
  participantFlightNumber: "LA411",
  participantAirline: "LATAM",
  participantArrivalTime: "2026-09-29T21:59",
  participantDepartureFlightNumber: "LA406",
  participantDepartureTime: "2026-10-18T09:35",
};
const COORD = { participantStatus: "PERSONAL_DATA_VALIDATED", participantFullName: "Claribel Fonseca", countryCode: "CHL", participantUserType: "COORDINADOR_TRANSPORTE" };

describe("filtros de AND", () => {
  it("por conductor (de llegada o de salida) y sin conductor", () => {
    expect(cumpleFiltroAnd(ALAN, { conductor: "hector" })).toBe(true);
    expect(cumpleFiltroAnd(ARMEN, { conductor: "hector" })).toBe(false);
    expect(cumpleFiltroAnd(ARMEN, { conductor: SIN_CONDUCTOR })).toBe(true);
    expect(cumpleFiltroAnd(ALAN, { conductor: SIN_CONDUCTOR })).toBe(false);
  });
  it("por país o región, vuelo (de llegada o salida), aerolínea y tipo de cliente", () => {
    expect(cumpleFiltroAnd(ALAN, { pais: "GBR" })).toBe(true);
    expect(cumpleFiltroAnd(ALAN, { vuelo: "QF28" })).toBe(true);
    expect(cumpleFiltroAnd(ALAN, { vuelo: "ar 1282" })).toBe(true);
    expect(cumpleFiltroAnd(ALAN, { aerolinea: "Qantas" })).toBe(true);
    expect(cumpleFiltroAnd(ARMEN, { aerolinea: "Qantas" })).toBe(false);
    expect(cumpleFiltroAnd(ARMEN, { tipoCliente: "TF" })).toBe(true);
  });
  it("por día de llegada, o de salida si se ven las salidas", () => {
    expect(cumpleFiltroAnd(ALAN, { dia: "2026-10-01" })).toBe(true);
    expect(cumpleFiltroAnd(ALAN, { dia: "2026-10-04" })).toBe(false);
    expect(cumpleFiltroAnd(ALAN, { dia: "2026-10-04", sentido: "DEPARTURE" })).toBe(true);
  });
});

describe("orden y días de AND", () => {
  it("por hora de llegada; sin vuelo al final", () => {
    expect(ordenarAnd([COORD, ALAN, ARMEN]).map((f) => f.participantFullName)).toEqual(["ARMEN ABI-SAAB", "ALAN GILPIN", "Claribel Fonseca"]);
  });
  it("con salidas, por hora de salida", () => {
    expect(ordenarAnd([ARMEN, ALAN], "DEPARTURE").map((f) => f.participantFullName)).toEqual(["ALAN GILPIN", "ARMEN ABI-SAAB"]);
  });
  it("agrupa por día, y lo sin fecha al final", () => {
    expect(agruparPorDia([COORD, ALAN, ARMEN]).map((g) => [g.dia, g.filas.length])).toEqual([
      ["2026-09-29", 1],
      ["2026-10-01", 1],
      ["", 1],
    ]);
  });
  it("opciones de los filtros con lo que hay en las fichas", () => {
    const v = valoresAnd([ALAN, ARMEN, COORD]);
    expect(v.paises).toEqual(["CHL", "GBR", "URY"]);
    expect(v.vuelos).toEqual(["AR1282", "LA406", "LA411", "QF28"]);
    expect(v.aerolineas).toEqual(["Aerolíneas Argentinas", "LATAM", "Qantas"]);
    expect(v.conductores).toEqual(["hector"]);
    expect(v.haySinConductor).toBe(true);
    expect(v.dias).toEqual(["2026-09-29", "2026-10-01"]);
  });
});
