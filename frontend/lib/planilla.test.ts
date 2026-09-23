import { describe, expect, it } from "vitest";
import {
  compararConPlanilla,
  generoNormalizado,
  rowDateToIso,
  tipoDeViajeEfectivo,
  type FilaPlanilla,
  type ViajeComparable,
} from "./planilla";

/**
 * La comparación planilla ↔ sistema es lo que la operación usa para saber si
 * lo cargado está bien. Estas pruebas fijan el calce (por fecha, tramo,
 * patente, origen y destino, nunca por hora) y qué cuenta como diferencia.
 */

// 08:15 en Chile el 23-09-2026 (UTC-3) son las 11:15 UTC.
const chile = (hhmm: string) => `2026-09-23T${String(Number(hhmm.slice(0, 2)) + 3).padStart(2, "0")}:${hhmm.slice(3)}:00.000Z`;

const fila = (extra: Partial<FilaPlanilla> = {}): FilaPlanilla => ({
  hoja: "Atletismo",
  fila: 2,
  busNumber: "Bus 1",
  legType: "Ida",
  clientType: "ATHLETE",
  clientName: "ANTOFAGASTA",
  date: "23-sept",
  discipline: "ATLETISMO",
  gender: "DAMAS Y VARONES",
  presentationTime: "07:00",
  originName: "Mahia Beach Hotel",
  departureTime: "07:45",
  arrivalTime: "08:15",
  destinationName: "Estadio Elías Figueroa Brander",
  passengerCount: 40,
  vehiclePlate: "GXVS17",
  driverName: "Alex Arevalo",
  ...extra,
});

const viaje = (extra: Partial<ViajeComparable> = {}): ViajeComparable => ({
  id: "v1",
  legType: "OUTBOUND",
  vehiclePlate: "GXVS-17",
  origin: "Mahia Beach Hotel",
  destination: "Estadio Elias Figueroa Brander",
  scheduledAt: chile("08:15"),
  presentationAt: chile("07:00"),
  discipline: "Atletismo",
  passengerCount: 40,
  driverId: "d1",
  delegationId: "del-anto",
  metadata: { gender: "DAMAS Y VARONES" },
  ...extra,
});

const ctx = {
  nombreDeLugar: () => undefined,
  nombreConductor: (id: string) => (id === "d1" ? "Alex Arévalo Pérez" : undefined),
  nombreRegion: (id: string) => (id === "del-anto" ? "Región de Antofagasta" : undefined),
  anioPorDefecto: "2026",
};

describe("generoNormalizado", () => {
  it("lleva lo que escribe la planilla a Masculino / Femenino / Mixto", () => {
    expect(generoNormalizado("DAMAS Y VARONES")).toBe("Mixto");
    expect(generoNormalizado("Femenino")).toBe("Femenino");
    expect(generoNormalizado("MASCULINO")).toBe("Masculino");
    expect(generoNormalizado("F")).toBe("Femenino");
    expect(generoNormalizado("M")).toBe("Masculino");
    expect(generoNormalizado("")).toBe("");
  });
});

describe("tipoDeViajeEfectivo", () => {
  it("sin tipo guardado, sale del tramo", () => {
    expect(tipoDeViajeEfectivo({ legType: "OUTBOUND" })).toBe("VIAJE_IDA");
    expect(tipoDeViajeEfectivo({ legType: "RETURN" })).toBe("VIAJE_REGRESO");
    expect(tipoDeViajeEfectivo({ tripType: "Entrenamiento", legType: "RETURN" })).toBe("Entrenamiento");
  });
});

describe("rowDateToIso", () => {
  it("entiende las fechas cortas de la planilla", () => {
    expect(rowDateToIso("23-sept", "2026")).toBe("2026-09-23");
    expect(rowDateToIso("2026-11-01", "2026")).toBe("2026-11-01");
  });
});

describe("compararConPlanilla", () => {
  it("una fila igual a su viaje no deja diferencias", () => {
    const r = compararConPlanilla([fila()], [viaje()], ctx);
    expect(r.filas[0].viajeId).toBe("v1");
    expect(r.filas[0].diferencias).toEqual([]);
    expect(r.porViaje.size).toBe(0);
    expect(r.sinViaje).toEqual([]);
    expect(r.sinFila).toEqual([]);
  });

  it("calza aunque el viaje traiga la regla vieja de horas, y anota las dos horas", () => {
    // Regla vieja: hora del viaje = llegada del bus (07:45) y presentación 15 min antes.
    const r = compararConPlanilla([fila()], [viaje({ scheduledAt: chile("07:45"), presentationAt: chile("07:30") })], ctx);
    expect(r.filas[0].viajeId).toBe("v1");
    expect(r.filas[0].diferencias).toEqual([
      { campo: "Presentación conductor", planilla: "07:00", sistema: "07:30" },
      { campo: "Hora del viaje", planilla: "08:15", sistema: "07:45" },
    ]);
    expect(r.porViaje.get("v1")).toHaveLength(2);
  });

  it("marca género, región, pasajeros y conductor distintos", () => {
    const r = compararConPlanilla(
      [fila()],
      [viaje({ metadata: { gender: "Femenino" }, delegationId: "otra", passengerCount: 12, driverId: null })],
      { ...ctx, nombreRegion: () => "Región de Atacama" },
    );
    expect(r.filas[0].diferencias.map((d) => d.campo)).toEqual(["Género", "Región", "Pasajeros", "Conductor"]);
  });

  it("todas las regiones calza sólo con un viaje de todas las regiones", () => {
    const ok = compararConPlanilla([fila({ clientName: "TODAS REGIONES" })], [viaje({ delegationId: null, allDelegations: true })], ctx);
    expect(ok.filas[0].diferencias).toEqual([]);
    const mal = compararConPlanilla([fila({ clientName: "TODAS REGIONES" })], [viaje()], ctx);
    expect(mal.filas[0].diferencias.map((d) => d.campo)).toEqual(["Región"]);
  });

  it("una fila sin viaje y un viaje sin fila se reportan aparte", () => {
    const r = compararConPlanilla(
      [fila(), fila({ fila: 3, vehiclePlate: "ZZZZ99" })],
      [viaje(), viaje({ id: "v2", vehiclePlate: "YYYY11" })],
      ctx,
    );
    expect(r.sinViaje.map((f) => f.fila)).toEqual([3]);
    expect(r.sinFila.map((v) => v.id)).toEqual(["v2"]);
  });

  it("con dos viajes del mismo servicio elige el de hora más cercana y no repite", () => {
    const r = compararConPlanilla(
      [fila({ arrivalTime: "08:15" }), fila({ fila: 3, arrivalTime: "15:00", presentationTime: "14:00" })],
      [viaje({ id: "tarde", scheduledAt: chile("15:00"), presentationAt: chile("14:00") }), viaje({ id: "manana" })],
      ctx,
    );
    expect(r.filas.map((f) => f.viajeId)).toEqual(["manana", "tarde"]);
    expect(r.porViaje.size).toBe(0);
  });

  it("calza por el nombre del catálogo cuando el viaje guarda otro texto", () => {
    const r = compararConPlanilla(
      [fila()],
      [viaje({ origin: "Av. Borgoño 14529", originHotelId: "h1" })],
      { ...ctx, nombreDeLugar: (id) => (id === "h1" ? "Mahia Beach Hotel" : undefined) },
    );
    expect(r.filas[0].viajeId).toBe("v1");
  });
});
