import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 28-09-2026: al sumar la pestaña Hoteles, la barra inferior de la app del
 * conductor quedó con 7 pestañas del mismo ancho y letra de 9,5 px. Medido en
 * Chrome: en un teléfono de 360 px "Actividades" se salía por el borde
 * izquierdo, y en 320 px "Reportes", "Documentos" y "Cuenta" se montaban.
 *
 * Con cada pestaña del ancho de su texto (flex 1 1 auto) y la letra de 10 px
 * de siempre, no hay cortes ni solapes en 320, 360, 390 ni 412 px. Esta prueba
 * falla si la barra vuelve a pestañas de ancho fijo.
 */
const pagina = readFileSync(join(__dirname, "..", "app", "portal", "conductor", "page.tsx"), "utf8");

describe("barra de pestañas de la app del conductor", () => {
  const regla = pagina.match(/\.dc-tab-btn\{[^}]*\}/)?.[0] ?? "";

  it("cada pestaña toma el ancho de su texto", () => {
    expect(regla).toContain("flex:1 1 auto");
    expect(regla).not.toMatch(/flex:1;/);
    expect(regla).not.toContain("min-width:0");
  });

  it("la letra sigue en 10 px y el texto no se parte", () => {
    expect(regla).toContain("font-size:10px");
    expect(regla).toContain("white-space:nowrap");
  });
});
