import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { choquesDelConductor, columnaDelViaje, duracionDelViaje, horaDelViaje } from "./mapa-calor-conductor";

/**
 * 30-09-2026: "que aparezca la hora real del traslado para visualizar mejor
 * choques de horario". El mapa decía "1" y el detalle "10:00" (la columna).
 */
// Hora de Chile (UTC-3 en septiembre de 2026).
const viaje = (id: string, hhmm: string, extra: Record<string, unknown> = {}) => ({
  id,
  scheduledAt: new Date(`2026-09-30T${hhmm}:00-03:00`).toISOString(),
  ...extra,
});

describe("mapa de calor: hora real y choques", () => {
  it("la hora del traslado y su columna van en hora de Chile", () => {
    const v = viaje("a", "10:20");
    expect(horaDelViaje(v)).toBe("10:20");
    expect(columnaDelViaje(v)).toBe(10);
    expect(columnaDelViaje(viaje("b", "23:40"))).toBe(23);
  });

  it("choque: empieza antes de que termine el anterior (duración cargada o 60 min)", () => {
    const choques = choquesDelConductor([
      viaje("ida", "10:00", { travelTimeMinutes: 45 }),
      viaje("otro", "10:30"), // antes de las 10:45
      viaje("tarde", "12:00"), // libre
    ]);
    expect(choques.get("ida")).toEqual(["10:30"]);
    expect(choques.get("otro")).toEqual(["10:00"]);
    expect(choques.has("tarde")).toBe(false);
    // sin duración cargada se suponen 60 min
    expect(choquesDelConductor([viaje("x", "08:00"), viaje("y", "08:50")]).get("y")).toEqual(["08:00"]);
    expect(choquesDelConductor([viaje("x", "08:00"), viaje("y", "09:05")]).size).toBe(0);
  });

  it("un cancelado no choca; un viaje terminado usa su duración real", () => {
    expect(choquesDelConductor([viaje("x", "08:00"), viaje("y", "08:30", { status: "CANCELLED" })]).size).toBe(0);
    const terminado = viaje("t", "08:00", {
      startedAt: new Date("2026-09-30T08:00:00-03:00").toISOString(),
      completedAt: new Date("2026-09-30T08:25:00-03:00").toISOString(),
    });
    expect(duracionDelViaje(terminado)).toBe(25);
    expect(choquesDelConductor([terminado, viaje("y", "08:40")]).size).toBe(0);
  });

  it("la casilla muestra las horas, con borde rojo si hay choque", () => {
    const pagina = readFileSync(join(__dirname, "..", "app", "(main)", "operations", "driver-heatmap", "page.tsx"), "utf8");
    expect(pagina).toContain("{horaDelViaje(tr) || \"—\"}");
    expect(pagina).toContain('outline: hayChoque ? "2px solid " + STATE.danger : "none"');
    expect(pagina).toContain("Choca con {choques.get(tr.id)!.join(\", \")}");
    expect(pagina).not.toContain('{driver?.fullName} · {String(h).padStart(2, "0")}:00');
  });
});
