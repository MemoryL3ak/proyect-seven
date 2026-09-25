import { describe, expect, it } from "vitest";
import { deporteDeViaje, viajeEsDeDisciplina } from "./discipline-filters";
import { generoDeViaje } from "./genero-viaje";

/**
 * Filtros de disciplina y género con los textos reales de la planilla
 * (base del 25-09-2026). Ariel: "¿por qué en algunos casos sigue sin
 * funcionar bien los filtros?". Cada caso es uno que fallaba.
 */
const catalogo = [
  { id: "futsal-f", name: "Futsal", gender: "FEMALE", category: "CONVENTIONAL" },
  { id: "futsal-m", name: "Futsal", gender: "MALE", category: "CONVENTIONAL" },
  { id: "voley-f", name: "Vóleibol", gender: "FEMALE", category: "CONVENTIONAL" },
  { id: "voley-m", name: "Vóleibol", gender: "MALE", category: "CONVENTIONAL" },
  { id: "atl", name: "Atletismo", gender: "MIXED", category: "CONVENTIONAL" },
  { id: "atl-para", name: "Atletismo", gender: "MIXED", category: "PARALYMPIC" },
];
const [futsalF, futsalM, voleyF, , atl, atlPara] = catalogo;

describe("viajeEsDeDisciplina", () => {
  it("Futsal · Femenino ya no trae los viajes de varones (218 viajes de futsal sin id)", () => {
    expect(viajeEsDeDisciplina({ discipline: "Futsal Femenino", metadata: { gender: "Femenino" } }, futsalF)).toBe(true);
    expect(viajeEsDeDisciplina({ discipline: "Futsal Masculino", metadata: { gender: "Masculino" } }, futsalF)).toBe(false);
    expect(viajeEsDeDisciplina({ discipline: "Futsal Masculino", metadata: { gender: "Masculino" } }, futsalM)).toBe(true);
  });

  it("la errata 'Futsal Maculino' cuenta como Futsal masculino (10 viajes)", () => {
    expect(viajeEsDeDisciplina({ discipline: "Futsal Maculino", metadata: { gender: "Masculino" } }, futsalM)).toBe(true);
    expect(viajeEsDeDisciplina({ discipline: "Futsal Maculino" }, futsalF)).toBe(false);
  });

  it("vóleibol sin género en la planilla lo toma del nombre (113 viajes)", () => {
    expect(viajeEsDeDisciplina({ discipline: "Voleibol Femenino" }, voleyF)).toBe(true);
    expect(viajeEsDeDisciplina({ discipline: "Voleibol Masculino" }, voleyF)).toBe(false);
  });

  it("'ATLETISMO DAMAS Y VARONES' es Atletismo convencional (29 viajes quedaban fuera)", () => {
    const v = { discipline: "ATLETISMO DAMAS Y VARONES", metadata: { gender: "DAMAS Y VARONES" } };
    expect(viajeEsDeDisciplina(v, atl)).toBe(true);
    expect(viajeEsDeDisciplina(v, atlPara)).toBe(false);
  });

  it("'Atletismo Paralimpico' y 'PARATLETISMO' son la paralímpica, no la convencional", () => {
    expect(viajeEsDeDisciplina({ discipline: "Atletismo Paralimpico" }, atlPara)).toBe(true);
    expect(viajeEsDeDisciplina({ discipline: "Atletismo Paralimpico" }, atl)).toBe(false);
    // Viene con el id de la convencional (7 viajes): manda el texto.
    expect(viajeEsDeDisciplina({ discipline: "PARATLETISMO", disciplineId: "atl" }, atl)).toBe(false);
    expect(viajeEsDeDisciplina({ discipline: "PARATLETISMO", disciplineId: "atl" }, atlPara)).toBe(true);
  });

  it("con id y texto concordantes manda el id", () => {
    expect(viajeEsDeDisciplina({ discipline: "Futsal", disciplineId: "futsal-f", metadata: { gender: "Femenino" } }, futsalF)).toBe(true);
  });
});

describe("deporteDeViaje agrupa bien los textos con género", () => {
  it("'ATLETISMO DAMAS Y VARONES' y 'Futsal Maculino' salen como su deporte", () => {
    expect(deporteDeViaje({ discipline: "ATLETISMO DAMAS Y VARONES" }, catalogo)).toBe("Atletismo");
    expect(deporteDeViaje({ discipline: "Futsal Maculino" }, catalogo)).toBe("Futsal");
    expect(deporteDeViaje({ discipline: "Atletismo Paralimpico" }, catalogo)).toBe("Atletismo · Paralímpica");
  });
});

describe("generoDeViaje", () => {
  it("lee el texto completo de la disciplina", () => {
    expect(generoDeViaje({ discipline: "ATLETISMO DAMAS Y VARONES" })).toBe("Mixto");
    expect(generoDeViaje({ discipline: "Voleibol Femenino" })).toBe("Femenino");
    expect(generoDeViaje({ discipline: "Futsal Maculino" })).toBe("Masculino");
  });
});
