import { describe, expect, it } from "vitest";
import { siguientePasoDelViaje, viajeEnCursoDeHoy } from "./viaje-en-curso";

const diaDe = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");
const HOY = "2026-10-02";

describe("viaje en curso", () => {
  it("el viaje de Juan Villegas (recogido a las 07:50, sin cerrar) es el que se abre al cargar", () => {
    const trips = [
      { id: "tarde", status: "SCHEDULED", scheduledAt: "2026-10-02T12:25:00" },
      { id: "3da7c9eb", status: "PICKED_UP", scheduledAt: "2026-10-02T07:40:00", startedAt: "2026-10-02T07:06:00" },
    ];
    expect(viajeEnCursoDeHoy(trips, HOY, diaDe)?.id).toBe("3da7c9eb");
  });

  it("sin viaje en curso no se abre ninguno", () => {
    const trips = [
      { id: "a", status: "SCHEDULED", scheduledAt: "2026-10-02T12:25:00" },
      { id: "b", status: "DROPPED_OFF", scheduledAt: "2026-10-02T07:40:00" },
    ];
    expect(viajeEnCursoDeHoy(trips, HOY, diaDe)).toBeNull();
  });

  it("un viaje que quedó abierto hace días no cuenta; uno de mañana ya iniciado sí", () => {
    const viejo = { id: "viejo", status: "EN_ROUTE", scheduledAt: "2026-09-20T09:00:00", startedAt: "2026-09-20T08:50:00" };
    expect(viajeEnCursoDeHoy([viejo], HOY, diaDe)).toBeNull();
    const adelantado = { id: "manana", status: "EN_ROUTE", scheduledAt: "2026-10-03T00:30:00", startedAt: "2026-10-02T23:40:00" };
    expect(viajeEnCursoDeHoy([viejo, adelantado], HOY, diaDe)?.id).toBe("manana");
    expect(viajeEnCursoDeHoy([{ id: "sin-fecha", status: "PICKED_UP" }], HOY, diaDe)?.id).toBe("sin-fecha");
  });

  it("el paso que falta es el mismo rótulo del botón de la tarjeta", () => {
    expect(siguientePasoDelViaje("PICKED_UP")).toBe("Llegamos al destino");
    expect(siguientePasoDelViaje("EN_ROUTE")).toBe("Pasajero recogido");
    expect(siguientePasoDelViaje("PICKED_UP", { solicitudPortal: true })).toBe("Finalizar viaje");
    expect(siguientePasoDelViaje("PICKED_UP", { disposicion: true })).toBe("Finalizar servicio");
    expect(siguientePasoDelViaje("EN_ROUTE", { disposicion: true })).toBe("Finalizar servicio");
    expect(siguientePasoDelViaje("SCHEDULED")).toBeNull();
    expect(siguientePasoDelViaje("DROPPED_OFF")).toBeNull();
    expect(siguientePasoDelViaje(null)).toBeNull();
  });
});
