import { describe, expect, it } from "vitest";
import { deporteDeViaje } from "./discipline-filters";

/**
 * El filtro de disciplina de Viajes en curso agrupaba por el texto crudo de
 * la planilla: "ATLETISMO", "Voleibol" y "Voleibol Masculino" eran tres
 * opciones, y los viajes con id y sin texto no aparecían. Estas pruebas fijan
 * que el deporte sale del catálogo, por id o por nombre, sin separar género.
 */
const catalogo = [
  { id: "atl", name: "Atletismo", gender: "MIXED", category: "CONVENTIONAL" },
  { id: "atl-para", name: "Atletismo", gender: "MIXED", category: "PARALYMPIC" },
  { id: "fut-f", name: "Futsal", gender: "FEMALE", category: "CONVENTIONAL" },
  { id: "fut-m", name: "Futsal", gender: "MALE", category: "CONVENTIONAL" },
  { id: "vol-f", name: "Vóleibol", gender: "FEMALE", category: "CONVENTIONAL" },
  { id: "vol-m", name: "Vóleibol", gender: "MALE", category: "CONVENTIONAL" },
];

describe("deporteDeViaje", () => {
  it("usa el nombre del catálogo cuando el viaje trae id, aunque no traiga texto", () => {
    expect(deporteDeViaje({ disciplineId: "fut-m" }, catalogo)).toBe("Futsal");
    expect(deporteDeViaje({ disciplineId: "fut-f", discipline: "FUTSAL" }, catalogo)).toBe("Futsal");
  });

  it("junta las variantes de escritura de la planilla en un solo deporte", () => {
    expect(deporteDeViaje({ discipline: "ATLETISMO" }, catalogo)).toBe("Atletismo");
    expect(deporteDeViaje({ discipline: "Voleibol" }, catalogo)).toBe("Vóleibol");
    expect(deporteDeViaje({ discipline: "Voleibol Masculino" }, catalogo)).toBe("Vóleibol");
  });

  it("separa la categoría paralímpica pero no el género", () => {
    expect(deporteDeViaje({ discipline: "PARATLETISMO" }, catalogo)).toBe("Atletismo · Paralímpica");
    expect(deporteDeViaje({ disciplineId: "atl-para" }, catalogo)).toBe("Atletismo · Paralímpica");
    expect(deporteDeViaje({ disciplineId: "vol-f" }, catalogo)).toBe(deporteDeViaje({ disciplineId: "vol-m" }, catalogo));
  });

  it("deja el texto tal cual cuando no calza con el catálogo, y nada cuando no hay deporte", () => {
    expect(deporteDeViaje({ discipline: "Lanzamiento de Martillo" }, catalogo)).toBe("Lanzamiento de Martillo");
    expect(deporteDeViaje({ discipline: "  " }, catalogo)).toBeNull();
    expect(deporteDeViaje({}, catalogo)).toBeNull();
  });
});
