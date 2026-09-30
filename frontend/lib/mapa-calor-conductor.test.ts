import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { choquesDelConductor, columnaDelViaje, duracionDelViaje, flotaPorHora, horaDelViaje } from "./mapa-calor-conductor";

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

/**
 * 30-09-2026: "al panel de conductores podríamos agregar filtros: conductor,
 * día, cantidad de flota por horario".
 */
describe("panel de conductores: filtros y flota por hora", () => {
  it("flota en uso: vehículos distintos ocupados en cada hora, contando la duración", () => {
    const viajes = [
      viaje("a", "10:20", { driverId: "bus1", travelTimeMinutes: 90, tipo: "BUS" }), // 10 y 11
      viaje("b", "10:40", { driverId: "van1", travelTimeMinutes: 30, tipo: "VAN_15" }), // 10 y 11 (hasta 11:10)
      viaje("c", "10:50", { driverId: "bus1", travelTimeMinutes: 20, tipo: "BUS" }), // mismo bus: cuenta una vez
      viaje("d", "12:00", { driverId: "van2", status: "CANCELLED", tipo: "VAN_15" }), // cancelado: no ocupa
    ];
    const uso = flotaPorHora(viajes, [9, 10, 11, 12], (v) => String((v as { tipo?: string }).tipo));
    expect(uso.get(9)?.total).toBe(0);
    expect(uso.get(10)?.total).toBe(2);
    expect(Object.fromEntries(uso.get(10)!.porTipo)).toEqual({ BUS: 1, VAN_15: 1 });
    expect(uso.get(11)?.total).toBe(2);
    expect(uso.get(12)?.total).toBe(0);
  });

  it("la página tiene arriba día, conductor y flota, sin selector de fecha nativo, y la fila de flota en uso", () => {
    const pagina = readFileSync(join(__dirname, "..", "app", "(main)", "operations", "driver-heatmap", "page.tsx"), "utf8");
    expect(pagina).not.toContain('type="date"');
    expect(pagina).toContain('<StyledSelect value={filtroFlota} onChange={(e) => setFiltroFlota(e.target.value)}>');
    expect(pagina).toContain("<StyledSelect value={jornadaConductor} onChange={(e) => setJornadaConductor(e.target.value)}>");
    expect(pagina).toContain("Flota en uso");
    // el mapa y los indicadores usan los filtros; los choques, todos los viajes
    expect(pagina).toContain("const flotaHoras = useMemo(() => flotaPorHora(viajesVista, HOURS, flotaDelViaje), [viajesVista]);");
    expect(pagina).toContain("for (const [id, horas] of choquesDelConductor(lista)) todos.set(id, horas);");
  });
});

