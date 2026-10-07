import { describe, expect, it } from "vitest";
import { debeRearmarRastreo, ESPERA_REARME_MS, gpsWebNecesario, mismoEstadoShell, shellSinFijos, UMBRAL_SIN_FIJOS_MS, viajesPorCalificar } from "./conductor-sondeos";

const T = Date.parse("2026-09-23T15:00:00.000Z");
const hace = (h: number) => new Date(T - h * 3600_000).toISOString();

describe("viajesPorCalificar", () => {
  it("sólo los cerrados hace menos de un día, sin calificación y no consultados", () => {
    const trips = [
      { id: "hoy", status: "COMPLETED", completedAt: hace(2) },
      { id: "ayer", status: "COMPLETED", completedAt: hace(30) },
      { id: "calificado", status: "COMPLETED", completedAt: hace(1), driverRating: 5 },
      { id: "ya-visto", status: "COMPLETED", completedAt: hace(1) },
      { id: "en-curso", status: "EN_ROUTE", startedAt: hace(1) },
      { id: "dejado", status: "DROPPED_OFF", startedAt: hace(3) },
    ];
    expect(viajesPorCalificar(trips, new Set(["ya-visto"]), T)).toEqual(["hoy", "dejado"]);
  });

  it("sin fecha de cierre ni de inicio no se consulta", () => {
    expect(viajesPorCalificar([{ id: "x", status: "COMPLETED" }], new Set(), T)).toEqual([]);
  });
});

describe("gpsWebNecesario", () => {
  it("en el navegador siempre manda la web", () => {
    expect(gpsWebNecesario({ running: true, backgroundOk: true }, false)).toBe(true);
  });

  it("dentro de la app, con el shell rastreando en segundo plano, la web no duplica", () => {
    expect(gpsWebNecesario({ running: true, backgroundOk: true }, true)).toBe(false);
  });

  it("dentro de la app sin rastreo nativo (shell viejo, sin permiso o apagado) la web cubre", () => {
    expect(gpsWebNecesario(null, true)).toBe(true);
    expect(gpsWebNecesario({ running: true, backgroundOk: false }, true)).toBe(true);
    expect(gpsWebNecesario({ running: false, backgroundOk: true }, true)).toBe(true);
  });

  it("si el shell dice que rastrea pero no entrega fijos, la web vuelve a cubrir", () => {
    expect(gpsWebNecesario({ running: true, backgroundOk: true, sinFijos: true }, true)).toBe(true);
    expect(gpsWebNecesario({ running: true, backgroundOk: true, sinFijos: false }, true)).toBe(false);
  });
});

describe("shellSinFijos", () => {
  // Armando Soza, 07-10-2026: Galaxy S25 con la app abierta, "rastreo en
  // segundo plano", dos fijos al abrir y nada más durante 5 minutos.
  it("running sin un intento de envío en 45 s es rastreo mudo", () => {
    const andando = { running: true, backgroundOk: true, lastPush: { lastAttemptAt: T - 3_000 } };
    expect(shellSinFijos(andando, T, null)).toBe(false);
    const mudo = { running: true, backgroundOk: true, lastPush: { lastAttemptAt: T - UMBRAL_SIN_FIJOS_MS - 1 } };
    expect(shellSinFijos(mudo, T, null)).toBe(true);
  });

  it("sin ningún intento registrado (app recién abierta) cuenta desde que se vio running", () => {
    const sinIntentos = { running: true, backgroundOk: true, lastPush: { lastAttemptAt: null } };
    expect(shellSinFijos(sinIntentos, T, null)).toBe(false);
    expect(shellSinFijos(sinIntentos, T, T - 10_000)).toBe(false);
    expect(shellSinFijos(sinIntentos, T, T - 60_000)).toBe(true);
  });

  it("un rastreo detenido o un shell sin respuesta no es 'mudo': ya tienen su propio estado", () => {
    expect(shellSinFijos({ running: false, backgroundOk: true }, T, T - 60_000)).toBe(false);
    expect(shellSinFijos(null, T, T - 60_000)).toBe(false);
  });
});

describe("debeRearmarRastreo", () => {
  const AHORA = 1_000_000;

  it("rearma cuando el rastreo aparece detenido con permiso de fondo y GPS encendido", () => {
    expect(debeRearmarRastreo({ running: false, backgroundOk: true, gpsServices: true }, AHORA, 0)).toBe(true);
  });

  it("no insiste sin permiso de fondo, con GPS apagado, con shell viejo o si ya está andando", () => {
    expect(debeRearmarRastreo({ running: false, backgroundOk: false }, AHORA, 0)).toBe(false);
    expect(debeRearmarRastreo({ running: false, backgroundOk: true, gpsServices: false }, AHORA, 0)).toBe(false);
    expect(debeRearmarRastreo({ running: false }, AHORA, 0)).toBe(false);
    expect(debeRearmarRastreo({ running: true, backgroundOk: true }, AHORA, 0)).toBe(false);
    expect(debeRearmarRastreo(null, AHORA, 0)).toBe(false);
  });

  it("también rearma cuando dice que rastrea pero no entrega (stop + start desde el portal)", () => {
    const mudo = { running: true, backgroundOk: true, gpsServices: true, sinFijos: true };
    expect(debeRearmarRastreo(mudo, T, 0)).toBe(true);
    expect(debeRearmarRastreo({ ...mudo, backgroundOk: false }, T, 0)).toBe(false);
    expect(debeRearmarRastreo({ ...mudo, sinFijos: false }, T, 0)).toBe(false);
  });

  it("como mucho una vez por minuto", () => {
    const estado = { running: false, backgroundOk: true, gpsServices: true };
    expect(debeRearmarRastreo(estado, AHORA, AHORA - 30_000)).toBe(false);
    expect(debeRearmarRastreo(estado, AHORA, AHORA - ESPERA_REARME_MS)).toBe(true);
  });
});

describe("mismoEstadoShell", () => {
  it("ignora lo que cambia cada 3 s (el último envío) y mira sólo el estado", () => {
    const a = { running: true, backgroundOk: true, gpsServices: true, background: "granted", lastPush: { lastAttemptAt: 1 } };
    const b = { ...a, lastPush: { lastAttemptAt: 2 } };
    expect(mismoEstadoShell(a, b)).toBe(true);
    // Que el shell pase a mudo (o deje de serlo) sí es un cambio de estado.
    expect(mismoEstadoShell(a, { ...a, sinFijos: true })).toBe(false);
    expect(mismoEstadoShell({ running: true, backgroundOk: true }, { running: false, backgroundOk: true })).toBe(false);
    expect(mismoEstadoShell(null, { running: true })).toBe(false);
    expect(mismoEstadoShell(null, null)).toBe(true);
  });
});
