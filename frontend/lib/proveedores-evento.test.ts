import { describe, expect, it } from "vitest";
import {
  accionAlQuitar,
  agregarEvento,
  eventosParaNuevo,
  nombresDeEventos,
  otrosEventos,
  participantesDelEvento,
  proveedorEnEvento,
  proveedoresDelEvento,
  proveedoresParaTraer,
  quitarEvento,
  recortar,
} from "./proveedores-evento";

/**
 * 28-09-2026: "los proveedores deben asociarse a un evento". Con World Rugby
 * creado, Ariel entraba a Proveedores y veía los 19 de los Juegos Escolares.
 */
const JDE = "11111111-1111-1111-1111-111111111111";
const RUGBY = "22222222-2222-2222-2222-222222222222";
const EVENTOS = [
  { id: JDE, name: "Final Nacional sub 14 Juegos Deportivos Escolares 2026" },
  { id: RUGBY, name: "World Rugby U20 Championship 2026" },
];

// BVAN trabaja en los dos eventos; Transportes Andes sólo en los Juegos;
// "Sin evento" es una ficha antigua; BVAN Norte es subproveedor de BVAN.
const BVAN = { id: "bvan", name: "BVAN", eventIds: [JDE, RUGBY] };
const ANDES = { id: "andes", name: "Transportes Andes", eventIds: [JDE] };
const ANDES_SUR = { id: "andes-sur", name: "Andes Sur", parentProviderId: "andes", eventIds: [JDE] };
const LEGADO = { id: "legado", name: "Sin evento", eventIds: [] as string[] };
const BVAN_NORTE = { id: "bvan-norte", name: "BVAN Norte", parentProviderId: "bvan", eventIds: [JDE, RUGBY] };
const PROVEEDORES = [BVAN, ANDES, ANDES_SUR, LEGADO, BVAN_NORTE];

describe("proveedorEnEvento", () => {
  it("BVAN se ve en los dos eventos; Transportes Andes sólo en los Juegos", () => {
    expect(proveedorEnEvento(BVAN.eventIds, JDE)).toBe(true);
    expect(proveedorEnEvento(BVAN.eventIds, RUGBY)).toBe(true);
    expect(proveedorEnEvento(ANDES.eventIds, RUGBY)).toBe(false);
  });
  it("una ficha sin eventos se ve en todos, y sin evento activo no se filtra", () => {
    expect(proveedorEnEvento([], RUGBY)).toBe(true);
    expect(proveedorEnEvento(null, RUGBY)).toBe(true);
    expect(proveedorEnEvento(ANDES.eventIds, "")).toBe(true);
  });
});

describe("proveedoresDelEvento", () => {
  it("en World Rugby ya no salen los de los Juegos Escolares (el caso de Ariel)", () => {
    expect(proveedoresDelEvento(PROVEEDORES, RUGBY).map((p) => p.id)).toEqual(["bvan", "legado", "bvan-norte"]);
  });
  it("en los Juegos salen todos", () => {
    expect(proveedoresDelEvento(PROVEEDORES, JDE)).toHaveLength(5);
  });
});

describe("participantesDelEvento", () => {
  const personas = [
    { id: "p1", fullName: "Juan Pérez", providerId: "bvan" },
    { id: "p2", fullName: "Rosa Díaz", providerId: "andes" },
    { id: "p3", fullName: "Luis Soto", providerId: "andes-sur" },
    { id: "p4", fullName: "Ana Rojas", providerId: "legado" },
    { id: "p5", fullName: "Sin proveedor conocido", providerId: "borrado" },
  ];
  it("en World Rugby sólo los conductores de BVAN, más los de fichas sin evento", () => {
    expect(participantesDelEvento(personas, PROVEEDORES, RUGBY).map((p) => p.id)).toEqual(["p1", "p4", "p5"]);
  });
  it("sin evento activo, todos", () => {
    expect(participantesDelEvento(personas, PROVEEDORES, "")).toHaveLength(5);
  });
});

describe("proveedoresParaTraer", () => {
  it("en World Rugby se puede traer Transportes Andes, con su subproveedor", () => {
    const filas = proveedoresParaTraer(PROVEEDORES, RUGBY);
    expect(filas.map((f) => f.proveedor.id)).toEqual(["andes"]);
    expect(filas[0].subproveedores.map((s) => s.id)).toEqual(["andes-sur"]);
  });
  it("en los Juegos no hay nada que traer: todos están ya o no tienen eventos", () => {
    expect(proveedoresParaTraer(PROVEEDORES, JDE)).toEqual([]);
  });
  it("un subproveedor cuyo padre se borró se ofrece como principal", () => {
    const huerfano = { id: "h", name: "Huérfano", parentProviderId: "no-existe", eventIds: [JDE] };
    expect(proveedoresParaTraer([huerfano], RUGBY).map((f) => f.proveedor.id)).toEqual(["h"]);
  });
  it("un subproveedor de BVAN que quedó sólo en los Juegos se ofrece solo: BVAN ya está en World Rugby", () => {
    const bvanSur = { id: "bvan-sur", name: "BVAN Sur", parentProviderId: "bvan", eventIds: [JDE] };
    const filas = proveedoresParaTraer([...PROVEEDORES, bvanSur], RUGBY);
    expect(filas.map((f) => f.proveedor.id)).toEqual(["bvan-sur", "andes"]);
    expect(filas[0].subproveedores).toEqual([]);
  });
  it("sin evento activo no se ofrece nada", () => {
    expect(proveedoresParaTraer(PROVEEDORES, "")).toEqual([]);
  });
});

describe("agregarEvento", () => {
  it("agrega World Rugby a Transportes Andes sin tocar los Juegos", () => {
    expect(agregarEvento(ANDES.eventIds, RUGBY)).toEqual([JDE, RUGBY]);
  });
  it("no repite ni restringe una ficha sin eventos", () => {
    expect(agregarEvento(BVAN.eventIds, RUGBY)).toBeNull();
    expect(agregarEvento([], RUGBY)).toBeNull();
    expect(agregarEvento(ANDES.eventIds, "")).toBeNull();
  });
});

describe("accionAlQuitar y quitarEvento", () => {
  it("BVAN en World Rugby sólo sale de World Rugby: sigue en los Juegos", () => {
    expect(accionAlQuitar(BVAN.eventIds, RUGBY)).toBe("QUITAR_DEL_EVENTO");
    expect(quitarEvento(BVAN.eventIds, RUGBY)).toEqual([JDE]);
  });
  it("Transportes Andes, que es sólo de los Juegos, se elimina como antes", () => {
    expect(accionAlQuitar(ANDES.eventIds, JDE)).toBe("ELIMINAR");
    expect(accionAlQuitar(LEGADO.eventIds, JDE)).toBe("ELIMINAR");
  });
  it("el subproveedor sale junto con su proveedor y, si no le queda evento, sigue al padre", () => {
    expect(quitarEvento(BVAN_NORTE.eventIds, RUGBY, [JDE])).toEqual([JDE]);
    expect(quitarEvento([RUGBY], RUGBY, [JDE])).toEqual([JDE]);
    // Sin eventos se vería en todos, también en el que se quitó.
    expect(quitarEvento([], RUGBY, [JDE])).toEqual([JDE]);
  });
  it("nada que guardar si no estaba en el evento", () => {
    expect(quitarEvento(ANDES.eventIds, RUGBY)).toBeNull();
    expect(quitarEvento([RUGBY], RUGBY)).toBeNull();
  });
});

describe("eventosParaNuevo", () => {
  it("un proveedor nuevo queda en el evento activo", () => {
    expect(eventosParaNuevo(RUGBY)).toEqual([RUGBY]);
  });
  it("un subproveedor nuevo hereda los eventos de su padre", () => {
    expect(eventosParaNuevo(RUGBY, BVAN)).toEqual([JDE, RUGBY]);
    expect(eventosParaNuevo(RUGBY, LEGADO)).toEqual([RUGBY]);
  });
  it("sin evento activo no se manda nada (el backend hereda del padre)", () => {
    expect(eventosParaNuevo("")).toEqual([]);
  });
});

describe("otrosEventos y nombres", () => {
  it("la nota de BVAN en los Juegos dice World Rugby, recortado", () => {
    const otros = nombresDeEventos(otrosEventos(BVAN.eventIds, JDE), EVENTOS);
    expect(otros).toEqual(["World Rugby U20 Championship 2026"]);
    expect(recortar(otros[0])).toBe("World Rugby U20 Championshi…");
    expect(recortar("World Rugby")).toBe("World Rugby");
  });
  it("un evento borrado no deja un nombre vacío", () => {
    expect(nombresDeEventos(["no-existe", JDE], EVENTOS)).toEqual([EVENTOS[0].name]);
  });
});
