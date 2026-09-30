import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { delegationLabel, esRegion, etiquetaDeDelegacion } from "./delegations";

/**
 * 29-09-2026, Rugby: el detalle del viaje de "Delegación Canadá" decía
 * "Región: CAN". Las delegaciones de Rugby son países con sólo el código.
 */
const canada = { id: "can", countryCode: "CAN", name: "CAN", eventId: "rugby" };
const nuble = { id: "nb", countryCode: "CL-NB", name: "Región de Ñuble", eventId: "jde" };

describe("región o país", () => {
  it("un país con sólo el código se muestra con su nombre", () => {
    expect(delegationLabel(canada)).toBe("Canadá");
    expect(delegationLabel({ countryCode: "HKG" })).toBe("Hong Kong");
    expect(delegationLabel(nuble)).toBe("Región de Ñuble");
  });

  it("la etiqueta es Región en los Juegos Escolares y País en Rugby", () => {
    expect(esRegion(nuble)).toBe(true);
    expect(esRegion(canada)).toBe(false);
    expect(etiquetaDeDelegacion(canada)).toBe("País");
    expect(etiquetaDeDelegacion(nuble)).toBe("Región");
    // viaje sin delegación: según las del evento
    expect(etiquetaDeDelegacion(null, [canada])).toBe("País");
    expect(etiquetaDeDelegacion(null, [nuble])).toBe("Región");
  });

  it("el detalle del panel y la app usan la etiqueta, no 'Región' fijo", () => {
    const panel = readFileSync(join(__dirname, "..", "app", "(main)", "operations", "trips", "page.tsx"), "utf8");
    const app = readFileSync(join(__dirname, "..", "components", "portal", "MissionTrips.tsx"), "utf8");
    expect(panel).not.toContain('{ label: "Región", value: iregion');
    expect(panel).toContain("label: etiquetaDeDelegacion(");
    expect(app).toContain("{ label: t(etiquetaDelegacion), valor: region }");
  });
});
