import { describe, expect, it } from "vitest";
import { sinEtiquetasRepetidas } from "./opciones-sin-repetir";

/**
 * 17-10-2026: el estado del viaje ofrecía dos "Completado" (DROPPED_OFF, el
 * de la app del conductor, y COMPLETED, el del panel).
 */
describe("desplegable sin etiquetas repetidas", () => {
  const estados = [
    { label: "Programado", value: "SCHEDULED" },
    { label: "Completado", value: "DROPPED_OFF" },
    { label: "Completado", value: "COMPLETED" },
    { label: "Cancelado", value: "CANCELLED" },
  ];

  it("deja una sola 'Completado': la última declarada cuando el viaje no está en ninguna", () => {
    expect(sinEtiquetasRepetidas(estados, "SCHEDULED").map((o) => o.value)).toEqual(["SCHEDULED", "COMPLETED", "CANCELLED"]);
    expect(sinEtiquetasRepetidas(estados, "").map((o) => o.value)).toEqual(["SCHEDULED", "COMPLETED", "CANCELLED"]);
  });

  it("conserva la que ya tiene el viaje, así un DROPPED_OFF de la app se sigue viendo como Completado", () => {
    expect(sinEtiquetasRepetidas(estados, "DROPPED_OFF").map((o) => o.value)).toEqual(["SCHEDULED", "DROPPED_OFF", "CANCELLED"]);
    expect(sinEtiquetasRepetidas(estados, "COMPLETED").map((o) => o.value)).toEqual(["SCHEDULED", "COMPLETED", "CANCELLED"]);
  });

  it("no toca un desplegable sin repetidas ni el orden original", () => {
    const sinRepetir = estados.filter((o) => o.value !== "DROPPED_OFF");
    expect(sinEtiquetasRepetidas(sinRepetir, "SCHEDULED")).toEqual(sinRepetir);
    expect(sinEtiquetasRepetidas(estados, ["DROPPED_OFF"]).map((o) => o.value)).toEqual(["SCHEDULED", "DROPPED_OFF", "CANCELLED"]);
  });
});
