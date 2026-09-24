import { describe, expect, it } from "vitest";
import {
  coincideBusqueda,
  describirVehiculo,
  estadoDe,
  filtrarConductores,
  inicialesDe,
  saludoWhatsapp,
  vehiculoDe,
  type PresenciaConductor,
} from "./directorio-conductores";

/**
 * Directorio de conductores del Coordinador de Transporte (24-09-2026): la
 * lista completa con vehículo, proveedor, estado en vivo y contacto.
 */
const presencia = (extra: Partial<PresenciaConductor>): PresenciaConductor => ({
  driverId: "x", online: false, secondsSinceSeen: null, activeTrips: 0, dayTripCount: 0, activeTripStatus: null, ...extra,
});

describe("vehiculoDe / describirVehiculo", () => {
  it("arma la descripción desde la metadata de la ficha", () => {
    const v = vehiculoDe({ vehicleTipo: "van_15", vehiclePatente: "abcd12", vehicleMarca: "Toyota", vehicleModelo: "Hiace", vehicleAno: "2022", vehicleCapacity: "15" });
    expect(describirVehiculo(v)).toBe("Van 15-17 · ABCD12 · Toyota Hiace 2022 · 15 pax");
  });
  it("sin datos queda vacío", () => {
    expect(describirVehiculo(vehiculoDe(null))).toBe("");
    expect(describirVehiculo(vehiculoDe({ vehicleCapacity: "0" }))).toBe("");
  });
});

describe("estadoDe", () => {
  it("en viaje manda sobre en línea; sin señal hasta 10 min; luego desconectado", () => {
    expect(estadoDe(presencia({ activeTrips: 1, online: false }))).toBe("EN_VIAJE");
    expect(estadoDe(presencia({ online: true }))).toBe("EN_LINEA");
    expect(estadoDe(presencia({ secondsSinceSeen: 300 }))).toBe("SIN_SENAL");
    expect(estadoDe(presencia({ secondsSinceSeen: 3600 }))).toBe("DESCONECTADO");
    expect(estadoDe(undefined)).toBe("DESCONECTADO");
  });
});

describe("filtrarConductores", () => {
  const lista = [
    { id: "a", fullName: "ZOILA ROJAS", phone: "+56911111111", providerId: "p1", metadata: { vehiclePatente: "AA1111" } },
    { id: "b", fullName: "andrés pérez", phone: "+56922222222", providerId: "p2", metadata: {} },
    { id: "c", fullName: "Carla Díaz", phone: null, providerId: "p1", metadata: {} },
    { id: "d", fullName: "Borrado", providerId: "p1", status: "DELETED", metadata: {} },
  ];
  const vivo = new Map<string, PresenciaConductor>([
    ["b", presencia({ driverId: "b", activeTrips: 1 })],
    ["c", presencia({ driverId: "c", online: true })],
  ]);

  it("ordena en viaje, en línea y el resto por nombre; deja fuera a los borrados", () => {
    expect(filtrarConductores(lista, vivo, { busqueda: "", proveedorId: "", estado: "" }).map((c) => c.id)).toEqual(["b", "c", "a"]);
  });
  it("filtra por proveedor y por estado", () => {
    expect(filtrarConductores(lista, vivo, { busqueda: "", proveedorId: "p1", estado: "" }).map((c) => c.id)).toEqual(["c", "a"]);
    expect(filtrarConductores(lista, vivo, { busqueda: "", proveedorId: "", estado: "EN_VIAJE" }).map((c) => c.id)).toEqual(["b"]);
  });
  it("busca por nombre sin tildes, por teléfono o por patente", () => {
    expect(coincideBusqueda(lista[1], "andres")).toBe(true);
    expect(coincideBusqueda(lista[0], "aa11")).toBe(true);
    expect(coincideBusqueda(lista[0], "9111")).toBe(true);
    expect(coincideBusqueda(lista[2], "rojas")).toBe(false);
  });
});

describe("inicialesDe / saludoWhatsapp", () => {
  it("iniciales de las dos primeras palabras", () => {
    expect(inicialesDe("andrés pérez soto")).toBe("AP");
    expect(inicialesDe(null)).toBe("?");
  });
  it("el saludo nombra al chofer y a quien escribe", () => {
    expect(saludoWhatsapp("ANDRÉS PÉREZ", "Diego Cruz")).toBe("Hola Andrés, te escribe Diego Cruz de la coordinación de transporte.");
    expect(saludoWhatsapp(null, null)).toBe("Hola, te escribe la coordinación de transporte.");
  });
});
