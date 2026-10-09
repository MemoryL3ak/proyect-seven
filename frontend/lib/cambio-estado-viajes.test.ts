import { describe, expect, it } from "vitest";
import { esEstadoCambio, mensajeConfirmarCambio, mensajeResultadoCambio, OPCIONES_CAMBIO_ESTADO } from "./cambio-estado-viajes";

describe("cambio de estado en lote (Viajes)", () => {
  it("ofrece programado, en ruta, en curso, completado y cancelado; nada más", () => {
    expect([...OPCIONES_CAMBIO_ESTADO]).toEqual(["SCHEDULED", "EN_ROUTE", "PICKED_UP", "COMPLETED", "CANCELLED"]);
    expect(esEstadoCambio("DROPPED_OFF")).toBe(false);
    expect(esEstadoCambio("EN_ROUTE")).toBe(true);
  });

  it("confirma con el nombre del estado y avisa que queda en la bitácora", () => {
    const c = mensajeConfirmarCambio(4, "EN_ROUTE");
    expect(c.titulo).toBe('Cambiar 4 viajes a "En ruta"');
    expect(c.mensaje).toMatch(/bitácora/);
    expect(mensajeConfirmarCambio(1, "CANCELLED").titulo).toBe('Cambiar 1 viaje a "Cancelado"');
  });

  it("el resultado cuenta los cambiados y muestra el primer error", () => {
    expect(mensajeResultadoCambio({ requestedCount: 4, updatedCount: 4, errores: [] }, "COMPLETED")).toBe('4 viajes ahora en "Completado".');
    expect(mensajeResultadoCambio({ requestedCount: 2, updatedCount: 1, errores: [{ id: "x", mensaje: "Trip not found" }] }, "SCHEDULED"))
      .toBe('1 viaje ahora en "Programado". 1 no se pudo cambiar: Trip not found');
  });
});
