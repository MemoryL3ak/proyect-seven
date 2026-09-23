import { describe, expect, it } from "vitest";
import { nombreCortoRegion, pruebaVisiblePara, tituloEnfrentamiento } from "./pruebas";

describe("pruebaVisiblePara", () => {
  it("un partido sólo lo ven las dos regiones que juegan", () => {
    const partido = { delegationIds: ["maule", "coquimbo"] };
    expect(pruebaVisiblePara(partido, "maule")).toBe(true);
    expect(pruebaVisiblePara(partido, "coquimbo")).toBe(true);
    expect(pruebaVisiblePara(partido, "biobio")).toBe(false);
  });

  it("una prueba sin delegaciones es general, y sin delegación conocida se ve todo", () => {
    expect(pruebaVisiblePara({ delegationIds: [] }, "biobio")).toBe(true);
    expect(pruebaVisiblePara({}, "biobio")).toBe(true);
    expect(pruebaVisiblePara({ delegationIds: ["maule"] }, null)).toBe(true);
  });
});

describe("nombreCortoRegion", () => {
  it("recorta los nombres oficiales a como se dicen", () => {
    expect(nombreCortoRegion("Región del Maule")).toBe("Maule");
    expect(nombreCortoRegion("Región de Coquimbo")).toBe("Coquimbo");
    expect(nombreCortoRegion("Región de La Araucanía")).toBe("Araucanía");
    expect(nombreCortoRegion("Región Metropolitana de Santiago")).toBe("Metropolitana");
    expect(nombreCortoRegion("Región del Libertador General Bernardo O'Higgins")).toBe("O'Higgins");
    expect(nombreCortoRegion("Región de Aysén del General Carlos Ibáñez del Campo")).toBe("Aysén");
    expect(nombreCortoRegion("Región de Magallanes y de la Antártica Chilena")).toBe("Magallanes");
    expect(nombreCortoRegion("Región de Arica y Parinacota")).toBe("Arica y Parinacota");
    expect(nombreCortoRegion("Región de Ñuble")).toBe("Ñuble");
    expect(nombreCortoRegion("CL-VS")).toBe("CL-VS");
  });

  it("arma el enfrentamiento con dos regiones", () => {
    expect(tituloEnfrentamiento(["Región del Maule", "Región de Coquimbo"])).toBe("Maule vs Coquimbo");
    expect(tituloEnfrentamiento(["Región del Maule"])).toBe("Maule");
    expect(tituloEnfrentamiento([])).toBe("");
  });
});
