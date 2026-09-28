import { describe, expect, it } from "vitest";
import { moduloDeRuta, nivelEnRuta, nivelModulo, permisosDesdeMetadata } from "./permisos-panel";

/**
 * 28-09-2026: Víctor (Comité, World Rugby U20) mira Llegadas, Viajes y el
 * resto sin cambiar nada, edita Solicitudes T1/VIP e Incidencias, y no ve las
 * fichas de AND ni la Operatividad Diaria.
 */
const VICTOR = permisosDesdeMetadata({
  modules: ["operacion.llegadas", "operacion.salidas", "calendario", "operacion.tracking", "operacion.viajes", "operacion.solicitudes", "operacion.vip", "sede", "incidencias"],
  soloVer: ["operacion.llegadas", "operacion.salidas", "calendario", "operacion.tracking", "operacion.viajes", "operacion.vip", "sede"],
});

describe("permisos del panel", () => {
  it("cada pantalla tiene su módulo, también las de dentro", () => {
    expect(moduloDeRuta("/operations/flights")).toBe("operacion.llegadas");
    expect(moduloDeRuta("/operacion/and")).toBe("operacion.and");
    expect(moduloDeRuta("/sports-calendar/day/2026-10-01")).toBe("calendario");
    expect(moduloDeRuta("/operations/food/cenas")).toBe("alimentacion.general");
    expect(moduloDeRuta("/cuenta")).toBe("_always");
    expect(moduloDeRuta("/")).toBeNull();
  });

  it("Víctor mira Llegadas y Viajes, edita Solicitudes e Incidencias", () => {
    expect(nivelEnRuta(VICTOR, "/operations/flights")).toBe("ver");
    expect(nivelEnRuta(VICTOR, "/operations/trips")).toBe("ver");
    expect(nivelEnRuta(VICTOR, "/operations/trip-requests")).toBe("editar");
    expect(nivelEnRuta(VICTOR, "/incidents")).toBe("editar");
  });

  it("no entra a AND, Operatividad Diaria ni Monitoreo de Conductores", () => {
    expect(nivelEnRuta(VICTOR, "/operacion/and")).toBe("ninguno");
    expect(nivelEnRuta(VICTOR, "/operations/daily-transport")).toBe("ninguno");
    expect(nivelEnRuta(VICTOR, "/operations/driver-monitoring")).toBe("ninguno");
  });

  it("su cuenta y la ayuda siempre", () => {
    expect(nivelEnRuta(VICTOR, "/cuenta")).toBe("editar");
  });

  it("quien tenía AND, Viajes o Tracking conserva lo que se separó", () => {
    const antiguo = permisosDesdeMetadata({ modules: ["operacion.and", "operacion.viajes", "operacion.tracking"] });
    expect(nivelModulo(antiguo, "operacion.llegadas")).toBe("editar");
    expect(nivelModulo(antiguo, "operacion.solicitudes")).toBe("editar");
    expect(nivelModulo(antiguo, "operacion.conductores")).toBe("editar");
  });

  it("sin módulos (administrador) entra a todo", () => {
    expect(nivelEnRuta(permisosDesdeMetadata({ role: "Administrador" }), "/admin/usuarios")).toBe("editar");
  });
});
