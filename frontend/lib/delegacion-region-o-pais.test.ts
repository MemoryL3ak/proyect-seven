import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { delegationLabel, esRegion, etiquetaDeDelegacion, nombresDelegacion } from "./delegations";

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

/**
 * 29-09-2026: "en el evento de Rugby las regiones (delegaciones) acá son
 * países. Entonces nombrarlas como país" — el filtro del comité en la app
 * decía "Región · Todas las regiones".
 */
describe("nombre de las delegaciones del evento", () => {
  it("Rugby: País / Todos los países; Juegos Escolares: Región / Todas las regiones", () => {
    expect(nombresDelegacion([canada])).toMatchObject({ una: "País", todas: "Todos los países", sin: "Sin país", unaSola: "Un país" });
    expect(nombresDelegacion([nuble])).toMatchObject({ una: "Región", todas: "Todas las regiones", sin: "Sin región" });
    expect(nombresDelegacion([]).una).toBe("Región");
  });

  it("la app (filtro del comité y traslados) y el panel usan el nombre del evento", () => {
    const leer = (...r: string[]) => readFileSync(join(__dirname, "..", ...r), "utf8");
    const filtros = leer("components", "portal", "FiltrosComite.tsx");
    expect(filtros).toContain("rotulo={t(nombres.una)}");
    expect(filtros).toContain("etiquetaTodos={t(nombres.todas)}");
    expect(leer("components", "portal", "MissionTrips.tsx")).not.toContain('t("Todas las regiones")');
    expect(leer("app", "(main)", "operations", "trips", "page.tsx")).not.toContain('t("Todas las regiones")');
    expect(leer("app", "portal", "conductor", "page.tsx")).not.toContain('{ label: "Región", value: region }');
  });
});

