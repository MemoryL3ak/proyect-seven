import { describe, expect, it } from "vitest";
import { config } from "@/middleware";

// El matcher de Next es una expresión de ruta; para la prueba basta como regex.
const pasaPorLogin = (ruta: string) => new RegExp(`^${config.matcher[0]}$`).test(ruta);

describe("íconos fuera del login (13-10-2026: Safari mostraba otro ícono)", () => {
  it("los íconos se sirven sin redirigir al login", () => {
    for (const r of ["/favicon.ico", "/apple-touch-icon.png", "/icon-32.png", "/icon-16.png", "/icon-192.png", "/branding/LOGO-SEVEN-3.png"]) {
      expect(pasaPorLogin(r)).toBe(false);
    }
  });

  it("las páginas del panel siguen pidiendo sesión", () => {
    for (const r of ["/operations/trips", "/dashboard", "/operations/driver-monitoring"]) {
      expect(pasaPorLogin(r)).toBe(true);
    }
  });
});
