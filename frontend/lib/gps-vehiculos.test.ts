import { describe, expect, it } from "vitest";
import { datosVehiculo, estadoDeEquipo, fichaVehiculo, fusionarListas, fusionarPosiciones, idMarcadorEquipo, lineaEstadoVehiculo, marcaDeVin, marcadorDeEquipo, nombreEquipo, opcionesPatente, ordenarEquipos, resumenEquipos, situacionEquipo, unirMarcadores, type EquipoGps } from "./gps-vehiculos";
import type { PresenceMarker } from "@/components/DriverPresenceMap";

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
    // La tabla manda el mismo id al mapa para centrarlo ("ver en el mapa", 12-10-2026).
    expect(idMarcadorEquipo("862667088669224")).toBe(m?.id);
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

  it("la ficha del vehículo: cabecera con patente, marca y situación; indicadores grandes; detalles; pie con el equipo", () => {
    const extras = { voltaje: 14.7, rpm: 879, velocidadObd: 22, temperaturaMotor: 68, kmObd: 24613, combustiblePct: 28, vin: "ZFA334000JP673562", crudos: {} };
    const seg: EquipoGps = { ...base, imei: "019210285072", protocolo: "JT808", modelo: "SEG-9888G 0285072", vehiclePlate: "KBGB58", conductorNombre: "juan villegas", tripId: "trip-1", contacto: true, energiaExterna: true, senalPct: 77, ultimaPosicion: { ...base.ultimaPosicion!, satelites: 11, velocidad: 33.3, extras } };
    const f = fichaVehiculo(seg, T);
    expect(f).toMatchObject({ nombre: "KBGB58", subtitulo: "Fiat · SEG-9888G", insignia: "KBGB58", actualizado: "hace 20s" });
    expect(f.situacion).toEqual({ texto: "En movimiento", tono: "movimiento" });
    expect(f.indicadores).toEqual([
      { valor: "33", unidad: "km/h", label: "Velocidad" },
      { valor: "879", unidad: "rpm", label: "Motor" },
      { valor: "28", unidad: "%", label: "Combustible" },
    ]);
    expect(f.detalles.map((d) => `${d.label}: ${d.value}`)).toEqual([
      "Conductor: juan villegas", "Viaje: En viaje", "Contacto: puesto", "Velocidad del auto: 22 km/h", "Temp. motor: 68 °C", "Batería: 14,7 V", "Odómetro: 24.613 km", "Energía: del vehículo", "VIN: ZFA334000JP673562",
    ]);
    expect(f.pie[0]).toBe("ID 019210285072 · señal 77 % · 11 sat.");
    expect(f.pie[1]).toMatch(/^Última posición .* · hace 28s$/);
    // El marcador lleva la ficha, el titular y la patente en el pin.
    const m = marcadorDeEquipo(seg, T);
    expect(m?.fichaVehiculo).toEqual(f);
    expect(m?.estadoTexto).toBe("En movimiento");
    // Con patente, el pin es una placa con la patente completa y el color de su situación (13-10-2026).
    expect(m?.iniciales).toBe("KBGB58");
    expect(m?.pinPatente).toBe("KBGB58");
    expect(m?.color).toBe("#10b981");
    // Sin patente: círculo "GPS"; sin conexión, gris.
    const sinPlaca = marcadorDeEquipo({ ...seg, vehiclePlate: null, ultimoPaquete: iso(T - 3600_000) }, T);
    expect(sinPlaca?.pinPatente).toBeNull();
    expect(sinPlaca?.iniciales).toBe("GPS");
    expect(sinPlaca?.color).toBe("#94a3b8");
    // Un G500LS sin patente ni datos del auto: velocidad y satélites como indicadores, pin "GPS".
    const g = fichaVehiculo({ ...base, vehiclePlate: null, conductorNombre: null, tripId: null }, T);
    expect(g).toMatchObject({ nombre: "GPS ·669224", subtitulo: "Rastreador GT06", insignia: "GPS" });
    expect(g.indicadores).toEqual([{ valor: "42", unidad: "km/h", label: "Velocidad" }, { valor: "9", unidad: "sat.", label: "GPS" }]);
    expect(g.detalles).toEqual([{ label: "Conductor", value: "sin conductor" }, { label: "Viaje", value: "Sin viaje" }]);
    expect(g.pie[0]).toBe("IMEI 862667088669224");
    // Sin posición nunca: sin indicadores y el pie lo dice.
    const sinPos = fichaVehiculo({ ...base, ultimaPosicion: null, ultimoPaquete: iso(T - 9 * 3600_000) }, T);
    expect(sinPos.indicadores).toEqual([]);
    expect(sinPos.pie[1]).toBe("Sin posición todavía");
    expect(sinPos.situacion.tono).toBe("sinConexion");
  });

  it("el sondeo rápido (cada 2 s) mueve la posición y conserva los datos OBD; no retrocede a una más vieja", () => {
    const extras = { rpm: 906, voltaje: 14, crudos: {} };
    const seg: EquipoGps = { ...base, imei: "019210285072", ultimaPosicion: { ...base.ultimaPosicion!, extras, contacto: true } };
    const otro: EquipoGps = { ...base, imei: "866557086859487" };
    const rapida = { imei: "019210285072", conectado: true, ultimoPaquete: iso(T), posicion: { fecha: iso(T - 2_000), satelites: 12, lat: -33.46, lng: -70.53, velocidad: 50, rumbo: 90, valido: true, recibida: iso(T - 1_000) } };
    const r = fusionarPosiciones([seg, otro], [rapida]);
    expect(r[0].ultimaPosicion).toMatchObject({ lat: -33.46, lng: -70.53, velocidad: 50, recibida: iso(T - 1_000), extras, contacto: true });
    expect(r[0].ultimoPaquete).toBe(iso(T));
    expect(r[1]).toBe(otro);
    // Una posición más vieja que la que ya se tiene no pisa nada (misma referencia).
    const vieja = { ...rapida, posicion: { ...rapida.posicion, recibida: iso(T - 60_000), lat: -1 } };
    expect(fusionarPosiciones([seg], [vieja])).toEqual([seg]);
    expect(fusionarPosiciones([seg], [])).toEqual([seg]);
    // Un equipo que nunca tuvo posición la recibe entera.
    const sinPos = { ...seg, ultimaPosicion: null };
    expect(fusionarPosiciones([sinPos], [rapida])[0].ultimaPosicion?.lat).toBe(-33.46);
  });

  it("la lista completa (cada 8 s) no retrocede una posición que el sondeo rápido ya adelantó", () => {
    const rapido: EquipoGps = { ...base, ultimaPosicion: { ...base.ultimaPosicion!, lat: -33.46, recibida: iso(T - 1_000) }, ultimoPaquete: iso(T - 1_000) };
    const lento: EquipoGps = { ...base, label: "nuevo", ultimaPosicion: { ...base.ultimaPosicion!, recibida: iso(T - 9_000) }, ultimoPaquete: iso(T - 9_000) };
    const r = fusionarListas([rapido], [lento]);
    expect(r[0].label).toBe("nuevo");
    expect(r[0].ultimaPosicion?.lat).toBe(-33.46);
    expect(r[0].ultimoPaquete).toBe(iso(T - 1_000));
    // Si la lista completa trae una más nueva, manda ella.
    const masNuevo = { ...lento, ultimaPosicion: { ...lento.ultimaPosicion!, lat: -33.47, recibida: iso(T) } };
    expect(fusionarListas([rapido], [masNuevo])[0].ultimaPosicion?.lat).toBe(-33.47);
    // Equipos nuevos o que se fueron: manda la lista completa.
    expect(fusionarListas([rapido], []).length).toBe(0);
    expect(fusionarListas([], [lento])[0]).toBe(lento);
  });

  describe("un solo pin por auto (13-10-2026: se veían el celular y el equipo del mismo auto)", () => {
    const celular = (id: string, online: boolean): PresenceMarker => ({ id, lat: -33.5, lng: -70.6, name: id, online, onTrip: false, tripLabel: null, lastSeen: "", gpsTime: "", activeTrips: 0, platform: "app-android", clientTypes: [] });
    // base: KBGB58, conductor drv-1, GPS vivo.
    it("con el equipo reportando, se oculta el pin del celular de ese conductor", () => {
      const r = unirMarcadores([celular("drv-1", true), celular("drv-2", true)], [base], T);
      expect(r.map((m) => m.id)).toEqual(["drv-2", "gps:862667088669224"]);
    });
    it("con el equipo mudo y el celular reportando, queda sólo el celular", () => {
      const mudo = { ...base, ultimaPosicion: { ...base.ultimaPosicion!, recibida: iso(T - 10 * 60_000) } };
      expect(unirMarcadores([celular("drv-1", true)], [mudo], T).map((m) => m.id)).toEqual(["drv-1"]);
    });
    it("si ninguno reporta, queda el equipo con su última posición", () => {
      const mudo = { ...base, ultimaPosicion: { ...base.ultimaPosicion!, recibida: iso(T - 10 * 60_000) } };
      expect(unirMarcadores([celular("drv-1", false)], [mudo], T).map((m) => m.id)).toEqual(["gps:862667088669224"]);
    });
    it("un equipo sin conductor no oculta a nadie, y uno sin posición no aporta pin", () => {
      expect(unirMarcadores([celular("drv-1", true)], [{ ...base, conductorId: null }], T).map((m) => m.id)).toEqual(["drv-1", "gps:862667088669224"]);
      expect(unirMarcadores([celular("drv-1", true)], [{ ...base, ultimaPosicion: null }], T).map((m) => m.id)).toEqual(["drv-1"]);
    });
  });

  it("la columna 'Estado del vehículo' de la tabla resume contacto y datos OBD en una línea", () => {
    const extras = { rpm: 879, temperaturaMotor: 68, voltaje: 27.9, kmObd: 24615, combustiblePct: 28, crudos: {} };
    expect(lineaEstadoVehiculo({ ...base, contacto: true, ultimaPosicion: { ...base.ultimaPosicion!, extras } })).toBe("Contacto puesto · 879 rpm · 68 °C · 27,9 V · 24.615 km · 28 % comb.");
    expect(lineaEstadoVehiculo({ ...base, contacto: false })).toBe("Contacto apagado");
    expect(lineaEstadoVehiculo({ ...base, contacto: null, energiaExterna: false })).toBe("con batería interna");
    expect(lineaEstadoVehiculo({ ...base, contacto: null })).toBe("");
  });

  it("resumen y orden de las filas: conectados primero, por nombre", () => {
    const quieto = { ...base, imei: "2", vehiclePlate: "AAAA11", ultimaPosicion: { ...base.ultimaPosicion!, velocidad: 0 } };
    const apagado = { ...base, imei: "3", vehiclePlate: null, ultimoPaquete: iso(T - 3600_000) };
    expect(resumenEquipos([base, quieto, apagado], T)).toEqual({ movimiento: 1, motor: 0, detenido: 1, sinConexion: 1, sinPatente: 1 });
    expect(ordenarEquipos([apagado, base, quieto], T).map((e) => e.imei)).toEqual(["2", "862667088669224", "3"]);
  });

  it("el selector de patente filtra mientras se escribe y ofrece una patente nueva si no existe", () => {
    const conocidas = ["GXVS17", "GXVT80", "JJJC74", "jj jc-74", "KFLX38"];
    expect(opcionesPatente(conocidas, null, "")).toEqual({ lista: ["GXVS17", "GXVT80", "JJJC74", "KFLX38"], nueva: null });
    expect(opcionesPatente(conocidas, "GXVS17", "gxv")).toEqual({ lista: ["GXVT80"], nueva: null });
    expect(opcionesPatente(conocidas, null, "ab-cd 12")).toEqual({ lista: [], nueva: "ABCD12" });
    // La actual no se ofrece como nueva, y menos de 4 caracteres no es patente.
    expect(opcionesPatente(conocidas, "ABCD12", "abcd12").nueva).toBeNull();
    expect(opcionesPatente(conocidas, null, "ab1").nueva).toBeNull();
  });

  it("la marca sale de los tres primeros caracteres del VIN", () => {
    expect(marcaDeVin("ZFA334000JP673562")).toBe("Fiat");
    expect(marcaDeVin("9BWAB45U0PT123456")).toBe("Volkswagen");
    expect(marcaDeVin("KMHxx")).toBe("Hyundai");
    expect(marcaDeVin("XXX12345678901234")).toBeNull();
    expect(marcaDeVin(null)).toBeNull();
  });
});
