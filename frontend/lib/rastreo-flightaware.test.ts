import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 30-09-2026: el rastreo pasa a FlightAware (src/flights/flightaware.provider).
 * Los popups muestran la llegada a la puerta —la que Google llama "Llegó"—
 * además del aterrizaje, y de dónde viene el dato.
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, "..", ...r), "utf8");

describe("popups de rastreo", () => {
  it("panel: aterrizaje, llegada a puerta y fuente", () => {
    const panel = leer("app", "(main)", "operations", "flights", "page.tsx");
    expect(panel).toContain('t("Aterrizó:")');
    expect(panel).toContain("trackResult.arrGateActual &&");
    expect(panel).toContain('trackResult.provider === "flightaware" ? "FlightAware"');
  });

  it("app del conductor: lo mismo", () => {
    const app = leer("app", "portal", "conductor", "page.tsx");
    expect(app).toContain('<Row label="En puerta" value={fmtVueloHora(trackInfo.arrGateActual)} />');
    expect(app).toContain('trackInfo.provider === "flightaware" ? "FlightAware"');
  });
});
