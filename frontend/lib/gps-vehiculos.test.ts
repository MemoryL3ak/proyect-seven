import { describe, expect, it } from "vitest";
import { datosVehiculo, estadoDeEquipo, fichaEquipo, marcaDeVin, marcadorDeEquipo, nombreEquipo, situacionEquipo, type EquipoGps } from "./gps-vehiculos";

const T = Date.parse("2026-10-09T05:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const base: EquipoGps = {
  imei: "862667088669224",
  conectado: true,
  conectadoDesde: iso(T - 600_000),
  ultimoPaquete: iso(T - 20_000),
  ultimaPosicion: { fecha: iso(T - 30_000), satelites: 9, lat: -33.4543, lng: -70.5186, velocidad: 42, rumbo: 143, valido: true, recibida: iso(T - 28_000) },
  paquetes: 12,
  posicionesGuardadas: 10,
  vehiclePlate: "KBGB58",
  eventId: "ev-1",
  label: null,
  conductorId: "drv-1",
  conductorNombre: "juan villegas",
  tripId: "trip-1",
  ultimoError: null,
};

describe("equipos GPS de vehículo en el monitoreo", () => {
  it("el equipo de Ariel (09-10-2026): con paquete y posición recientes está conectado y con GPS vivo", () => {
    expect(estadoDeEquipo(base, T)).toEqual({ conectado: true, gpsVivo: true, edadGpsS: 28, edadPaqueteS: 20 });
  });

  it("sin paquete en 5 minutos queda sin conexión; sin posición en 3 minutos, sin GPS", () => {
    expect(estadoDeEquipo({ ...base, ultimoPaquete: iso(T - 6 * 60_000) }, T).conectado).toBe(false);
    expect(estadoDeEquipo({ ...base, ultimaPosicion: { ...base.ultimaPosicion!, recibida: iso(T - 4 * 60_000) } }, T).gpsVivo).toBe(false);
    expect(estadoDeEquipo({ ...base, ultimaPosicion: null }, T)).toMatchObject({ gpsVivo: false, edadGpsS: null });
  });

  it("se nombra por la patente; sin vehículo, por los últimos 6 del IMEI", () => {
    expect(nombreEquipo(base)).toBe("KBGB58");
    expect(nombreEquipo({ ...base, vehiclePlate: null })).toBe("GPS ·669224");
    expect(nombreEquipo({ ...base, vehiclePlate: null, label: "Auto de Ariel" })).toBe("Auto de Ariel");
    // JT808: el terminal se identifica por teléfono/ID y declara su modelo.
    expect(nombreEquipo({ ...base, imei: "019210285072", vehiclePlate: null, protocolo: "JT808", modelo: "SEG-9888G 0285072" })).toBe("SEG-9888G ·285072");
  });

  it("el marcador va en viaje sólo con viaje en curso y GPS vivo, y lleva IMEI, vehículo y conductor", () => {
    const m = marcadorDeEquipo(base, T);
    expect(m).toMatchObject({ id: "gps:862667088669224", name: "KBGB58", online: true, conectado: true, onTrip: true, platform: "gps-vehiculo", lat: -33.4543, lng: -70.5186 });
    expect(m?.detailRows?.map((r) => r.value)).toEqual(["862667088669224", "KBGB58", "juan villegas", "42 km/h"]);
    expect(marcadorDeEquipo({ ...base, tripId: null }, T)?.onTrip).toBe(false);
    expect(marcadorDeEquipo({ ...base, ultimaPosicion: null }, T)).toBeNull();
  });

  it("el SEG-9888G en el auto de Ariel (11-10-2026) muestra lo que lee por OBD: velocidad del auto, rpm, temperatura, batería, kilometraje, combustible y VIN", () => {
    const extras = { odometroEquipoKm: 1.6, senal: 24, voltaje: 14.7, cargaMotor: 30, rpm: 879, velocidadObd: 22, temperaturaMotor: 108, kmObd: 24613, combustiblePct: 28, vin: "ZFA334000JP673562", iccid: "8956032251741729749", crudos: { "85": "1b92" } };
    const seg: EquipoGps = { ...base, imei: "019210285072", protocolo: "JT808", modelo: "SEG-9888G 0285072", vehiclePlate: null, conductorNombre: null, tripId: null, ultimaPosicion: { ...base.ultimaPosicion!, velocidad: 33.3, extras } };
    expect(datosVehiculo(seg.ultimaPosicion).map((r) => r.value)).toEqual(["22 km/h", "879 rpm", "108 °C", "14,7 V", "24.613 km", "28 %"]);
    expect(marcadorDeEquipo(seg, T)?.detailRows?.map((r) => `${r.label}: ${r.value}`)).toEqual([
      "IMEI: 019210285072", "Vehículo: sin asignar", "Velocidad: 33 km/h",
      "Velocidad (auto): 22 km/h", "Motor: 879 rpm", "Temp. motor: 108 °C", "Batería: 14,7 V", "Odómetro: 24.613 km", "Combustible: 28 %", "VIN: ZFA334000JP673562",
    ]);
    // Con el motor apagado (por USB) sólo hay odómetro del equipo y señal: nada que mostrar del auto.
    expect(datosVehiculo({ ...base.ultimaPosicion!, extras: { odometroEquipoKm: 0, senal: 0, crudos: {} } })).toEqual([]);
    expect(datosVehiculo({ ...base.ultimaPosicion!, extras: { rpm: 0, voltaje: 12.2, crudos: {} } }).map((r) => r.value)).toEqual(["apagado", "12,2 V"]);
    // Los G500LS (GT06) no traen extras.
    expect(datosVehiculo(base.ultimaPosicion)).toEqual([]);
  });

  it("la situación del vehículo: en movimiento, detenido con motor encendido, detenido, sin señal o sin conexión", () => {
    expect(situacionEquipo(base, T)).toEqual({ texto: "En movimiento", tono: "movimiento" });
    const quieto = { ...base, ultimaPosicion: { ...base.ultimaPosicion!, velocidad: 0 } };
    expect(situacionEquipo(quieto, T).texto).toBe("Detenido");
    // Contacto puesto según el latido del GT06, o rpm > 0 según el SEG.
    expect(situacionEquipo({ ...quieto, contacto: true }, T)).toEqual({ texto: "Detenido, motor encendido", tono: "motor" });
    expect(situacionEquipo({ ...quieto, ultimaPosicion: { ...quieto.ultimaPosicion!, extras: { rpm: 906, crudos: {} } } }, T).tono).toBe("motor");
    expect(situacionEquipo({ ...quieto, ultimaPosicion: { ...quieto.ultimaPosicion!, recibida: iso(T - 10 * 60_000) } }, T).texto).toBe("Conectado, sin señal GPS");
    // El GPS ·669224 que Ariel vio "pésimo" (11-10-2026): 9 h sin paquete.
    expect(situacionEquipo({ ...base, ultimoPaquete: iso(T - 9 * 3600_000) }, T)).toEqual({ texto: "Sin conexión", tono: "sinConexion" });
  });

  it("la ficha del mapa va por secciones: vehículo, ahora y equipo, sin 'tipos de cliente' ni 'plataforma'", () => {
    const extras = { voltaje: 14.7, rpm: 879, velocidadObd: 22, temperaturaMotor: 68, kmObd: 24613, combustiblePct: 28, vin: "ZFA334000JP673562", crudos: {} };
    const seg: EquipoGps = { ...base, imei: "019210285072", protocolo: "JT808", modelo: "SEG-9888G 0285072", vehiclePlate: "KBGB58", conductorNombre: "juan villegas", tripId: "trip-1", contacto: true, energiaExterna: true, senalPct: 77, ultimaPosicion: { ...base.ultimaPosicion!, satelites: 11, velocidad: 33.3, extras } };
    const ficha = fichaEquipo(seg, T);
    expect(ficha.map((s) => s.titulo)).toEqual(["Vehículo", "Ahora", "Equipo"]);
    expect(ficha[0].filas).toEqual([
      { label: "Patente", value: "KBGB58" }, { label: "Marca", value: "Fiat" }, { label: "VIN", value: "ZFA334000JP673562" },
      { label: "Conductor", value: "juan villegas" }, { label: "Viaje", value: "En viaje" },
    ]);
    expect(ficha[1].filas.map((r) => `${r.label}: ${r.value}`)).toEqual([
      "Velocidad GPS: 33 km/h", "Velocidad (auto): 22 km/h", "Motor: 879 rpm", "Temp. motor: 68 °C", "Batería: 14,7 V", "Odómetro: 24.613 km", "Combustible: 28 %", "Contacto: puesto",
    ]);
    expect(ficha[2].filas.map((r) => r.label)).toEqual(["Equipo", "ID", "Señal celular", "Satélites", "Última posición", "Última conexión", "Energía"]);
    expect(ficha[2].filas[0].value).toBe("SEG-9888G");
    expect(ficha[2].filas[2].value).toBe("77 %");
    expect(ficha[2].filas[6].value).toBe("del vehículo");
    // El marcador lleva la ficha, el titular y la patente en el pin.
    const m = marcadorDeEquipo(seg, T);
    expect(m?.secciones).toEqual(ficha);
    expect(m?.estadoTexto).toBe("En movimiento");
    expect(m?.iniciales).toBe("KBGB");
    // Un G500LS sin patente ni datos del auto: ficha corta, pin "GPS".
    const g = marcadorDeEquipo({ ...base, vehiclePlate: null, conductorNombre: null, tripId: null }, T);
    expect(g?.iniciales).toBe("GPS");
    expect(g?.secciones?.[0].filas.map((r) => r.value)).toEqual(["sin asignar", "—", "Sin viaje en curso"]);
    expect(g?.secciones?.[2].filas.map((r) => r.label)).toEqual(["Equipo", "IMEI", "Satélites", "Última posición", "Última conexión"]);
    expect(g?.secciones?.[2].filas[0].value).toBe("Rastreador GT06");
  });

  it("la marca sale de los tres primeros caracteres del VIN", () => {
    expect(marcaDeVin("ZFA334000JP673562")).toBe("Fiat");
    expect(marcaDeVin("9BWAB45U0PT123456")).toBe("Volkswagen");
    expect(marcaDeVin("KMHxx")).toBe("Hyundai");
    expect(marcaDeVin("XXX12345678901234")).toBeNull();
    expect(marcaDeVin(null)).toBeNull();
  });
});
