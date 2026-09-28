import { describe, expect, it } from "vitest";
import { aCampoFechaHora, cuerpoRegistro, errorDeRegistro, horasPorDefecto } from "./registro-traslado";

/**
 * 28-09-2026: Marcelo llevó a Fernando Ginzo el 27-09 (H2 1811, 21:50) sin
 * marcarlo en la app. Registrarlo al día siguiente debe guardar las horas de
 * ese día, no las del clic.
 */
const GINZO = { scheduledAt: "2026-09-28T00:50:00.000Z", driverId: "marcelo" };
const AL_DIA_SIGUIENTE = new Date("2026-09-28T19:30:00.000Z");

describe("registro manual de un traslado", () => {
  it("el campo de fecha y hora vuelve a la misma hora", () => {
    expect(new Date(aCampoFechaHora(GINZO.scheduledAt)).toISOString()).toBe(GINZO.scheduledAt);
  });

  it("de un traslado de otro día propone su hora y una hora de duración, no la del clic", () => {
    expect(horasPorDefecto(GINZO, AL_DIA_SIGUIENTE)).toEqual({
      inicio: aCampoFechaHora("2026-09-28T00:50:00.000Z"),
      termino: aCampoFechaHora("2026-09-28T01:50:00.000Z"),
    });
  });

  it("de un traslado de hace un rato propone terminar ahora", () => {
    const ahora = new Date("2026-09-28T01:30:00.000Z");
    expect(horasPorDefecto(GINZO, ahora).termino).toBe(aCampoFechaHora(ahora));
  });

  it("respeta las horas que ya marcó el conductor", () => {
    const marcado = { ...GINZO, startedAt: "2026-09-28T00:55:00.000Z", completedAt: "2026-09-28T01:40:00.000Z" };
    expect(horasPorDefecto(marcado, AL_DIA_SIGUIENTE)).toEqual({
      inicio: aCampoFechaHora(marcado.startedAt),
      termino: aCampoFechaHora(marcado.completedAt),
    });
  });

  it("no deja guardar horas imposibles", () => {
    const inicio = aCampoFechaHora("2026-09-28T00:50:00.000Z");
    expect(errorDeRegistro(inicio, aCampoFechaHora("2026-09-28T00:40:00.000Z"), AL_DIA_SIGUIENTE)).toMatch(/antes del inicio/);
    expect(errorDeRegistro(inicio, aCampoFechaHora("2026-09-29T00:40:00.000Z"), AL_DIA_SIGUIENTE)).toMatch(/futuro/);
    expect(errorDeRegistro("", inicio, AL_DIA_SIGUIENTE)).toMatch(/inicio/);
    expect(errorDeRegistro(inicio, aCampoFechaHora("2026-09-28T01:50:00.000Z"), AL_DIA_SIGUIENTE)).toBeNull();
  });

  it("deja el viaje completado con las horas reales y la marca en la bitácora", () => {
    const cuerpo = cuerpoRegistro(
      {
        inicio: aCampoFechaHora("2026-09-28T00:50:00.000Z"),
        termino: aCampoFechaHora("2026-09-28T01:50:00.000Z"),
        driverId: "marcelo",
        donde: "Monitoreo de Llegadas",
      },
      AL_DIA_SIGUIENTE,
    );
    expect(cuerpo).toMatchObject({
      status: "COMPLETED",
      startedAt: "2026-09-28T00:50:00.000Z",
      completedAt: "2026-09-28T01:50:00.000Z",
      driverId: "marcelo",
    });
    expect(cuerpo.metadata.log[0]).toMatchObject({ action: "REGISTRO_MANUAL", by: "Monitoreo de Llegadas" });
    expect(cuerpo.metadata.log[0].detail).toContain("21:50");
  });
});
