import { describe, expect, it } from "vitest";
import { claseFlota, consumoDeCobros, esTransfer, pesosCortos, resumenLicitacion, type CobroTransporte } from "./cobros-transporte";

const cobros: CobroTransporte[] = [
  { id: "aero-auto", sistema: "Aeropuerto", modalidad: "POR_VIAJE", flota: "AUTO_SUV", clientPrice: 180000, cantidad: 17, providerIds: ["jorge", "marcelo"] },
  { id: "bus-ta", sistema: "Bus dedicado TA", modalidad: "POR_VEHICULO_DIA", flota: "BUS", clientPrice: 444500, cantidad: 63, providerIds: ["beltour", "arevalo"] },
  { id: "van-staff", sistema: "Van staff WR", modalidad: "POR_VEHICULO_DIA", flota: "VAN", clientPrice: 249500, cantidad: 19, providerIds: ["pino"] },
];

const proveedorDe = (driverId: string) =>
  ({ d1: "jorge", d2: "marcelo", d3: "beltour", d4: "arevalo", d5: "pino", d9: "otro" })[driverId] ?? null;

const viaje = (id: string, extra: Partial<Parameters<typeof consumoDeCobros>[1][number]>) => ({
  id, status: "COMPLETED", tripType: "VIAJE_IDA", requestedVehicleType: "Bus", scheduledAt: "2026-10-02T11:00:00-03:00", driverId: "d3", ...extra,
});

describe("claseFlota y esTransfer", () => {
  it("clasifica el vehículo pedido en las tres clases del plan", () => {
    expect(claseFlota("Sedán")).toBe("AUTO_SUV");
    expect(claseFlota("SUV")).toBe("AUTO_SUV");
    expect(claseFlota("Auto")).toBe("AUTO_SUV");
    expect(claseFlota("Van")).toBe("VAN");
    expect(claseFlota("VAN_19")).toBe("VAN");
    expect(claseFlota("Minibus")).toBe("VAN");
    expect(claseFlota("Bus")).toBe("BUS");
    expect(claseFlota("BUS")).toBe("BUS");
    expect(claseFlota("?")).toBeNull();
  });

  it("los traslados de aeropuerto son TRANSFER_*", () => {
    expect(esTransfer("TRANSFER_IN")).toBe(true);
    expect(esTransfer("TRANSFER_IN_OUT")).toBe(true);
    expect(esTransfer("Entrenamiento")).toBe(false);
  });
});

describe("consumoDeCobros", () => {
  it("por viaje cuenta los traslados de aeropuerto del proveedor con esa flota", () => {
    const consumo = consumoDeCobros(cobros, [
      viaje("t1", { tripType: "TRANSFER_IN", requestedVehicleType: "Sedán", driverId: "d1" }),
      viaje("t2", { tripType: "TRANSFER_IN", requestedVehicleType: "SUV", driverId: "d2", status: "SCHEDULED" }),
      viaje("t3", { tripType: "TRANSFER_IN", requestedVehicleType: "Sedán", driverId: "d1", status: "CANCELLED" }),
      viaje("t4", { tripType: "TRANSFER_IN", requestedVehicleType: "Van", driverId: "d1" }),
      viaje("t5", { tripType: "TRANSFER_IN", requestedVehicleType: "Sedán", driverId: "d9" }),
    ], proveedorDe);
    expect(consumo.get("aero-auto")?.get("jorge")).toEqual({ programados: 1, realizados: 1 });
    expect(consumo.get("aero-auto")?.get("marcelo")).toEqual({ programados: 1, realizados: 0 });
  });

  it("por vehículo-día, un bus con cuatro traslados en el día es un bus-día", () => {
    const consumo = consumoDeCobros(cobros, [
      viaje("b1", { driverId: "d3", scheduledAt: "2026-10-02T07:50:00-03:00" }),
      viaje("b2", { driverId: "d3", scheduledAt: "2026-10-02T11:50:00-03:00" }),
      viaje("b3", { driverId: "d3", scheduledAt: "2026-10-02T14:30:00-03:00", status: "SCHEDULED" }),
      viaje("b4", { driverId: "d3", scheduledAt: "2026-10-02T20:40:00-03:00" }),
      viaje("b5", { driverId: "d3", scheduledAt: "2026-10-03T09:00:00-03:00", status: "SCHEDULED" }),
      viaje("b6", { driverId: "d4", scheduledAt: "2026-10-02T09:00:00-03:00" }),
      // un traslado de aeropuerto del mismo bus no es un bus-día
      viaje("b7", { driverId: "d3", tripType: "TRANSFER_IN", scheduledAt: "2026-10-02T02:00:00-03:00" }),
    ], proveedorDe);
    expect(consumo.get("bus-ta")?.get("beltour")).toEqual({ programados: 2, realizados: 1 });
    expect(consumo.get("bus-ta")?.get("arevalo")).toEqual({ programados: 1, realizados: 1 });
  });

  it("el día es el del evento, no el UTC: un viaje a las 23:30 de Chile sigue siendo de ese día", () => {
    const consumo = consumoDeCobros(cobros, [
      viaje("n1", { driverId: "d5", requestedVehicleType: "Van", scheduledAt: "2026-10-02T23:30:00-03:00" }),
      viaje("n2", { driverId: "d5", requestedVehicleType: "Van", scheduledAt: "2026-10-02T07:30:00-03:00" }),
    ], proveedorDe);
    expect(consumo.get("van-staff")?.get("pino")).toEqual({ programados: 1, realizados: 1 });
  });
});

describe("resumenLicitacion", () => {
  it("totales, avance, por sistema y por proveedor (exclusivo vs compartido)", () => {
    const consumo = consumoDeCobros(cobros, [
      viaje("t1", { tripType: "TRANSFER_IN", requestedVehicleType: "Sedán", driverId: "d1" }),
      viaje("b1", { driverId: "d3" }),
      viaje("b2", { driverId: "d4", status: "SCHEDULED" }),
      viaje("v1", { driverId: "d5", requestedVehicleType: "Van" }),
    ], proveedorDe);
    const r = resumenLicitacion(cobros, consumo);
    expect(r.licitado).toBe(180000 * 17 + 444500 * 63 + 249500 * 19);
    expect(r.consumido).toBe(180000 + 444500 + 249500);
    expect(r.programado).toBe(180000 + 444500 * 2 + 249500);
    expect(r.porFacturar).toBe(r.licitado - r.consumido);
    expect(r.avance).toBe(Math.round((r.consumido / r.licitado) * 100));
    expect(r.porSistema[0]).toMatchObject({ sistema: "Bus dedicado TA", licitado: 444500 * 63, consumido: 444500 });
    const pino = r.porProveedor.find((p) => p.providerId === "pino");
    expect(pino).toMatchObject({ licitadoExclusivo: 249500 * 19, licitadoCompartido: 0, consumido: 249500, realizados: 1 });
    const beltour = r.porProveedor.find((p) => p.providerId === "beltour");
    expect(beltour).toMatchObject({ licitadoExclusivo: 0, licitadoCompartido: 444500 * 63, consumido: 444500, programado: 444500 });
    const arevalo = r.porProveedor.find((p) => p.providerId === "arevalo");
    expect(arevalo).toMatchObject({ consumido: 0, programado: 444500, programados: 1 });
    expect(r.cobros.find((c) => c.id === "bus-ta")).toMatchObject({ programados: 2, realizados: 1, avance: 2 });
  });

  it("sin cobros todo queda en cero, sin dividir por cero", () => {
    const r = resumenLicitacion([], new Map());
    expect(r).toMatchObject({ licitado: 0, consumido: 0, avance: 0, porFacturar: 0 });
  });
});

describe("pesosCortos", () => {
  it("abrevia en millones y miles", () => {
    expect(pesosCortos(28003500)).toBe("$28 M");
    expect(pesosCortos(4740500)).toBe("$4,7 M");
    expect(pesosCortos(180000)).toBe("$180 k");
  });
});
