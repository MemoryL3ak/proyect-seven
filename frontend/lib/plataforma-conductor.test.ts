import { describe, expect, it } from "vitest";
import { avisoCodigoCompartido, esSesionDesplazada, etiquetaPlataforma, plataformaConductor, sistemaDelTelefono, versionShell } from "./plataforma-conductor";

const ANDROID_APP = "Mozilla/5.0 (Linux; Android 16; SM-S928B Build/BP4A.251205.006; wv) AppleWebKit/537.36 Chrome/153.0.8010.36 Mobile Safari/537.36";
const ANDROID_SAMSUNG = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

describe("plataformaConductor", () => {
  it("distingue Android, iPhone y otros", () => {
    expect(sistemaDelTelefono(ANDROID_APP)).toBe("android");
    expect(sistemaDelTelefono(IPHONE)).toBe("iphone");
    expect(sistemaDelTelefono("Mozilla/5.0 (Windows NT 10.0)")).toBe("otro");
  });

  it("en el navegador (Israel Orellana, Samsung Internet) no hay rastreo de fondo", () => {
    expect(plataformaConductor({ userAgent: ANDROID_SAMSUNG, dentroDeLaApp: false, shell: null })).toBe("navegador-android");
    expect(etiquetaPlataforma("navegador-android")).toEqual({ texto: "Navegador Android · sin rastreo de fondo", alerta: true });
  });

  it("dentro de la app el estado del shell dice qué pasa", () => {
    const app = (shell: Parameters<typeof plataformaConductor>[0]["shell"]) =>
      plataformaConductor({ userAgent: ANDROID_APP, dentroDeLaApp: true, shell });
    expect(app({ running: true, backgroundOk: true, gpsServices: true })).toBe("app-android:fondo-ok");
    expect(app({ running: true, backgroundOk: false, gpsServices: true })).toBe("app-android:sin-fondo");
    expect(app({ running: false, backgroundOk: true, gpsServices: false })).toBe("app-android:gps-apagado");
    expect(app({ running: false, backgroundOk: true, gpsServices: true })).toBe("app-android:detenido");
    // El shell 1.0.1 responde tracking.status sin backgroundOk.
    expect(app({ running: false })).toBe("app-android:antigua");
    expect(app(null)).toBe("app-android:sin-respuesta");
    expect(plataformaConductor({ userAgent: IPHONE, dentroDeLaApp: true, shell: { running: true, backgroundOk: true } })).toBe("app-iphone:fondo-ok");
  });

  it("la versión del shell se deduce de backgroundOk", () => {
    expect(versionShell(null)).toBeNull();
    expect(versionShell({ running: false })).toBe("1.0.1");
    expect(versionShell({ running: true, backgroundOk: true })).toBe("1.0.2+");
  });

  it("las etiquetas del monitor marcan alerta cuando el rastreo no cubre", () => {
    expect(etiquetaPlataforma("app-android:fondo-ok")).toEqual({ texto: "App Android · rastreo en segundo plano", alerta: false });
    expect(etiquetaPlataforma("app-android:sin-fondo")?.alerta).toBe(true);
    expect(etiquetaPlataforma("app-android:antigua")?.texto).toContain("actualizar");
    expect(etiquetaPlataforma("app-iphone:gps-apagado")).toEqual({ texto: "App iPhone · GPS apagado", alerta: true });
    // Latidos anteriores al 30-09-2026 y códigos desconocidos se muestran tal cual.
    expect(etiquetaPlataforma("web")).toEqual({ texto: "Web", alerta: false });
    expect(etiquetaPlataforma("raro")).toEqual({ texto: "raro", alerta: false });
    expect(etiquetaPlataforma(null)).toBeNull();
  });
});

describe("código compartido y sesión desplazada", () => {
  it("avisa cuando el código tuvo sesión en dos tipos de teléfono el mismo día", () => {
    // Juan Villegas, 02-10-2026: iPhone en Concón y Android en Santiago.
    expect(avisoCodigoCompartido(["iPhone", "Android"])).toBe("Código en 2 teléfonos hoy: iPhone y Android");
    expect(avisoCodigoCompartido(["Android", "Android"])).toBeNull();
    expect(avisoCodigoCompartido(["Android", "otro"])).toBeNull();
    expect(avisoCodigoCompartido(null)).toBeNull();
  });

  it("un 401 de la API es la sesión tomada por otro teléfono", () => {
    expect(esSesionDesplazada(Object.assign(new Error("Autenticación requerida"), { status: 401 }))).toBe(true);
    expect(esSesionDesplazada(Object.assign(new Error("Error"), { status: 500 }))).toBe(false);
    expect(esSesionDesplazada(new Error("red"))).toBe(false);
  });
});
