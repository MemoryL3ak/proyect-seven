import { describe, expect, it } from "vitest";
import { columnasConductores, etiquetasVisibles } from "./tabla-conductores";

describe("tabla Detalle de conductores", () => {
  it("en Rugby (sin regiones ni disciplinas) no hay columnas de '—' y la última conexión no es columna aparte", () => {
    const rugby = [{ delegationName: null, disciplines: [] }, { delegationName: "", disciplines: null }];
    expect(columnasConductores(rugby, "Región", true)).toEqual(["Conductor", "Estado", "Ocupación", "Viajes hoy", "Tipo cliente", "Sesión", "GPS"]);
  });

  it("en JDE, con regiones y disciplinas, aparecen; y otro día dice 'Viajes del día'", () => {
    const jde = [{ delegationName: "Valparaíso", disciplines: [] }, { delegationName: null, disciplines: ["Judo"] }];
    expect(columnasConductores(jde, "Región", false)).toEqual(["Conductor", "Región", "Estado", "Ocupación", "Viajes del día", "Tipo cliente", "Disciplinas", "Sesión", "GPS"]);
  });

  it("hasta 3 tipos de cliente y el resto en '+N' (Alex Arévalo tenía 8)", () => {
    const tipos = ["TA", "TF", "COMITE_ORGANIZADOR", "COORDINADOR_COMITE", "JEFE_MISION", "PROVEEDORES", "VIP", "T1"];
    const { visibles, resto } = etiquetasVisibles(tipos);
    expect(visibles).toEqual(["TA", "TF", "COMITE_ORGANIZADOR"]);
    expect(resto.length).toBe(5);
    expect(etiquetasVisibles(["TA"])).toEqual({ visibles: ["TA"], resto: [] });
    expect(etiquetasVisibles(null)).toEqual({ visibles: [], resto: [] });
  });
});
