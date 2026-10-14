import { describe, expect, it } from "vitest";
import { createPinIcon, createPlacaPinIcon } from "@/components/DriverPresenceMap";
import { createDestinationFlagIcon, createDriverCarIcon } from "@/components/LiveTrackingMap";

const svgDe = (dataUrl: string) => decodeURIComponent(dataUrl.replace(/^data:image\/svg\+xml;charset=UTF-8,/, ""));

describe("pines del mapa en Safari / iPhone (14-10-2026: la placa salía sólo con el texto)", () => {
  it("la sombra se referencia como url(#…) dentro del SVG; url(%23…) es una referencia rota y Safari no dibuja lo que la usa", () => {
    const pines = {
      placa: createPlacaPinIcon("KBGB58", "#3b82f6"),
      circulo: createPinIcon("JV", "#10b981"),
      auto: createDriverCarIcon("JV", "#10b981"),
      destino: createDestinationFlagIcon("#ef4444"),
    };
    for (const [nombre, url] of Object.entries(pines)) {
      const svg = svgDe(url);
      expect(svg, nombre).toMatch(/filter="url\(#ds2?\)"/);
      expect(svg, nombre).not.toContain("%23");
      // El filtro referido existe.
      const ref = svg.match(/filter="url\(#(\w+)\)"/)?.[1];
      expect(svg, nombre).toContain(`<filter id="${ref}"`);
    }
  });

  it("la placa lleva la patente completa con letra sin serifa, igual en todos los equipos", () => {
    const svg = svgDe(createPlacaPinIcon("GXVS17", "#f59e0b"));
    expect(svg).toContain(">GXVS17</text>");
    expect(svg).toContain("sans-serif");
    expect(svg).not.toContain("textLength");
  });
});
