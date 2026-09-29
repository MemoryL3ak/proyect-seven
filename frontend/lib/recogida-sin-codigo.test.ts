import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 29-09-2026: "debemos quitar la solicitud de código en los viajes. debemos
 * liberarlo en todos los casos". El conductor pedía el código de usuario del
 * pasajero para marcar "Pasajero recogido" en los viajes VIP; ahora la
 * recogida se confirma directo en todos los viajes, en el portal (que es
 * también la app) y en la app prototipo mobile/.
 */
const portal = readFileSync(join(__dirname, "..", "app", "portal", "conductor", "page.tsx"), "utf8");
const prototipo = readFileSync(join(__dirname, "..", "..", "mobile", "app", "conductor.tsx"), "utf8");

describe("recogida del pasajero sin código", () => {
  it("el portal del conductor marca PICKED_UP directo, sin excepción por tipo de viaje", () => {
    const i = portal.indexOf("const confirmPickup = (trip: Trip) => {");
    expect(i).toBeGreaterThan(-1);
    const cuerpo = portal.slice(i, portal.indexOf("};", i));
    expect(cuerpo).toContain('updateTrip(trip.id, "PICKED_UP")');
    expect(cuerpo).not.toContain("VIP");
    expect(cuerpo).not.toContain("setPickupTrip");
  });

  it("el portal ya no tiene la ventana de código de verificación", () => {
    expect(portal).not.toContain("pickupCode");
    expect(portal).not.toContain("getPickupCandidates");
    expect(portal).not.toContain('t("Código de verificación")');
  });

  it("la app prototipo tampoco pide código", () => {
    expect(prototipo).not.toContain("pickupCode");
    expect(prototipo).not.toContain("Código de verificación");
    expect(prototipo).toContain("onPress={() => updateTrip(trip.id, 'PICKED_UP')}");
  });
});
