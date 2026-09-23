import { describe, expect, it } from "vitest";
import { categoriaCredencial, zonasConcedidas } from "./credencial-jde";

describe("categoriaCredencial", () => {
  it("el formato oficial: invitado con la I", () => {
    expect(categoriaCredencial({ userType: "VIP" })).toMatchObject({ letra: "I", categoria: "INVITADO" });
    expect(categoriaCredencial({ roleLabel: "Participante" })).toMatchObject({ letra: "I", categoria: "INVITADO" });
    expect(categoriaCredencial({})).toMatchObject({ letra: "I", categoria: "INVITADO" });
  });

  it("cada tipo de participante lleva su categoría", () => {
    expect(categoriaCredencial({ userType: "TA" })).toMatchObject({ letra: "D", categoria: "DEPORTISTA" });
    expect(categoriaCredencial({ userType: "JEFE_MISION" })).toMatchObject({ letra: "JM", categoria: "JEFE DE MISIÓN" });
    expect(categoriaCredencial({ roleLabel: "JEFE DE MISIÓN" })).toMatchObject({ letra: "JM" });
    expect(categoriaCredencial({ userType: "TF" })).toMatchObject({ letra: "OT", categoria: "OFICIAL TÉCNICO" });
    expect(categoriaCredencial({ userType: "TM" })).toMatchObject({ letra: "P", categoria: "PRENSA" });
    expect(categoriaCredencial({ userType: "COORDINADOR_COMITE" })).toMatchObject({ letra: "O", categoria: "ORGANIZACIÓN" });
    expect(categoriaCredencial({ userType: "COORDINADOR_SEDE" })).toMatchObject({ letra: "CS" });
    expect(categoriaCredencial({ userType: "PROVEEDORES" })).toMatchObject({ letra: "PR", categoria: "PROVEEDOR" });
  });

  it("un conductor es conductor venga como venga", () => {
    expect(categoriaCredencial({ subjectType: "DRIVER" })).toMatchObject({ letra: "C", categoria: "CONDUCTOR" });
    expect(categoriaCredencial({ roleLabel: "Conductor" })).toMatchObject({ letra: "C" });
  });

  it("una categoría escrita a mano manda, y su letra sale del texto si no se da", () => {
    expect(categoriaCredencial({ userType: "TA", categoria: "Voluntario" })).toMatchObject({ letra: "V", categoria: "VOLUNTARIO" });
    expect(categoriaCredencial({ categoria: "Árbitro", letra: "AR" })).toMatchObject({ letra: "AR", categoria: "ÁRBITRO" });
  });
});

describe("zonasConcedidas", () => {
  it("imprime sólo las concedidas, en el orden del catálogo, y salta las desconocidas", () => {
    expect(zonasConcedidas(["rd", "C", "X"]).map((z) => z.codigo)).toEqual(["C", "RD"]);
    expect(zonasConcedidas([])).toEqual([]);
    expect(zonasConcedidas(null)).toEqual([]);
  });
});
