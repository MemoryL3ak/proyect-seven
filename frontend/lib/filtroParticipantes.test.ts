import { describe, expect, it } from "vitest";
import {
  FILTROS_PARTICIPANTES_VACIOS,
  contarFiltrosParticipantesActivos,
  contarPorOpcion,
  disciplinasDelParticipante,
  filtrarParticipantes,
} from "./filtroParticipantes";

type P = {
  id: string;
  fullName: string;
  delegationId?: string | null;
  disciplineId?: string | null;
  disciplineIds?: string[];
  userType?: string | null;
  validado: boolean;
};

const esValidado = (p: P) => p.validado;

const gente: P[] = [
  { id: "1", fullName: "Vai Tiare Salinas", delegationId: "coquimbo", disciplineIds: ["futsal", "voleibol"], userType: "JEFE_MISION", validado: true },
  { id: "2", fullName: "Ariel Beroíza", delegationId: null, userType: "COMITE_ORGANIZADOR", validado: true },
  { id: "3", fullName: "Pedro Pérez", delegationId: "coquimbo", disciplineId: "futsal", userType: "TA", validado: false },
  { id: "4", fullName: "María Soto", delegationId: "maule", disciplineId: "voleibol", userType: "TA", validado: true },
];

describe("filtrarParticipantes", () => {
  it("sin filtros devuelve a todos", () => {
    expect(filtrarParticipantes(gente, FILTROS_PARTICIPANTES_VACIOS, esValidado)).toHaveLength(4);
  });

  it("busca por nombre sin distinguir mayúsculas ni espacios de más", () => {
    const r = filtrarParticipantes(gente, { ...FILTROS_PARTICIPANTES_VACIOS, busqueda: "  salinas " }, esValidado);
    expect(r.map((p) => p.id)).toEqual(["1"]);
  });

  it("separa validados de pendientes", () => {
    expect(filtrarParticipantes(gente, { ...FILTROS_PARTICIPANTES_VACIOS, estado: "pending" }, esValidado).map((p) => p.id)).toEqual(["3"]);
    expect(filtrarParticipantes(gente, { ...FILTROS_PARTICIPANTES_VACIOS, estado: "validated" }, esValidado)).toHaveLength(3);
  });

  it("filtra por delegación (región)", () => {
    const r = filtrarParticipantes(gente, { ...FILTROS_PARTICIPANTES_VACIOS, delegationId: "coquimbo" }, esValidado);
    expect(r.map((p) => p.id)).toEqual(["1", "3"]);
  });

  it("la disciplina encuentra tanto al deportista como al Jefe de Misión que la cubre", () => {
    const r = filtrarParticipantes(gente, { ...FILTROS_PARTICIPANTES_VACIOS, disciplineId: "voleibol" }, esValidado);
    expect(r.map((p) => p.id)).toEqual(["1", "4"]);
  });

  it("filtra por tipo de participante", () => {
    const r = filtrarParticipantes(gente, { ...FILTROS_PARTICIPANTES_VACIOS, userType: "TA" }, esValidado);
    expect(r.map((p) => p.id)).toEqual(["3", "4"]);
  });

  it("los filtros se combinan", () => {
    const r = filtrarParticipantes(
      gente,
      { ...FILTROS_PARTICIPANTES_VACIOS, delegationId: "coquimbo", estado: "validated", disciplineId: "futsal" },
      esValidado,
    );
    expect(r.map((p) => p.id)).toEqual(["1"]);
  });
});

describe("disciplinasDelParticipante", () => {
  it("une disciplineIds con disciplineId sin repetir", () => {
    expect(disciplinasDelParticipante({ disciplineIds: ["a", "b"], disciplineId: "a" })).toEqual(["a", "b"]);
    expect(disciplinasDelParticipante({ disciplineId: "c" })).toEqual(["c"]);
    expect(disciplinasDelParticipante({ disciplineIds: "no-es-lista" })).toEqual([]);
  });
});

describe("contarFiltrosParticipantesActivos", () => {
  it("cuenta los desplegables puestos y no el buscador", () => {
    expect(contarFiltrosParticipantesActivos(FILTROS_PARTICIPANTES_VACIOS)).toBe(0);
    expect(contarFiltrosParticipantesActivos({ ...FILTROS_PARTICIPANTES_VACIOS, busqueda: "x" })).toBe(0);
    expect(contarFiltrosParticipantesActivos({ ...FILTROS_PARTICIPANTES_VACIOS, estado: "pending", userType: "TA" })).toBe(2);
  });
});

describe("contarPorOpcion", () => {
  it("cuenta cada opción con los demás filtros puestos, ignorando el propio", () => {
    const filtros = { ...FILTROS_PARTICIPANTES_VACIOS, delegationId: "coquimbo", userType: "TA" };
    // Aunque ya hay un tipo elegido, el desplegable de tipo muestra todos los
    // tipos de Coquimbo, para poder cambiar de uno a otro.
    const tipo = contarPorOpcion(gente, filtros, "userType", esValidado);
    expect(tipo.base).toHaveLength(2);
    expect(tipo.porValor.get("JEFE_MISION")).toBe(1);
    expect(tipo.porValor.get("TA")).toBe(1);

    const estado = contarPorOpcion(gente, filtros, "estado", esValidado);
    expect(estado.porValor.get("pending")).toBe(1);
    expect(estado.porValor.get("validated")).toBeUndefined();
  });

  it("en disciplina, el Jefe de Misión suma en cada una de las suyas", () => {
    const r = contarPorOpcion(gente, FILTROS_PARTICIPANTES_VACIOS, "disciplineId", esValidado);
    expect(r.porValor.get("futsal")).toBe(2);
    expect(r.porValor.get("voleibol")).toBe(2);
  });
});
