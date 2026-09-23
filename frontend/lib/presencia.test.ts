import { describe, expect, it } from "vitest";
import { VENTANA_CONECTADO_MS, desfaseReloj, estadoConexion } from "./presencia";

/**
 * El estado conectado/sin conexión parpadeaba porque la ventana (15 s) era
 * más corta que la cadencia del conductor (20 s). Estas pruebas fijan que la
 * ventana cubre esa cadencia con el refresco del panel encima, y que las
 * horas se comparan en el reloj del servidor.
 */
const T = Date.parse("2026-09-23T12:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("estadoConexion", () => {
  it("un conductor quieto que manda cada 20 s sigue conectado aunque el panel refresque cada 8 s", () => {
    // Peor caso: posición de hace 20 s, más 8 s hasta que el panel la trae, más latencia.
    expect(estadoConexion(iso(T - 29_000), T)?.conectado).toBe(true);
    expect(VENTANA_CONECTADO_MS).toBeGreaterThanOrEqual(30_000);
  });

  it("pasa a sin conexión cuando de verdad dejó de mandar, y a sin señal a los 5 minutos", () => {
    expect(estadoConexion(iso(T - VENTANA_CONECTADO_MS), T)).toMatchObject({ conectado: false, sinSenal: false });
    expect(estadoConexion(iso(T - 5 * 60_000), T)).toMatchObject({ conectado: false, sinSenal: true });
  });

  it("sin hora de recepción no hay estado", () => {
    expect(estadoConexion(null, T)).toBeNull();
    expect(estadoConexion("basura", T)).toBeNull();
  });
});

describe("desfaseReloj", () => {
  it("el PC del operador adelantado 40 s ya no envejece a los conductores", () => {
    // El servidor dice T; el PC cree que es T+40 s. Pedir la hora tardó 300 ms.
    const local0 = T + 40_000;
    const desfase = desfaseReloj(iso(T), local0, local0 + 300);
    expect(desfase).toBeCloseTo(-40_150, -2);
    const ahoraServidor = local0 + 300 + desfase;
    // Posición recibida hace 10 s en el servidor: conectado, no "hace 50 s".
    expect(estadoConexion(iso(T - 10_000), ahoraServidor)?.ageMs).toBeCloseTo(10_150, -2);
  });

  it("con una hora inválida no corrige nada", () => {
    expect(desfaseReloj("", 1, 2)).toBe(0);
  });
});
