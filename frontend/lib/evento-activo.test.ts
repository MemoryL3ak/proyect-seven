import { describe, expect, it } from "vitest";
import {
  diaDeFechaEvento,
  esDelEvento,
  etapaEvento,
  eventoPorDefecto,
  hoyEnChile,
  ordenarEventos,
  rangoEvento,
  resolverEventoActivo,
} from "./evento-activo";

/**
 * 27-09-2026: Ariel creó un segundo evento en plena operación de los Juegos
 * Escolares. Viajes volvía solo al evento más nuevo y las secciones sin
 * selector mezclaban los dos. El evento activo es ahora uno para todo el
 * panel y abre por defecto el que está en curso.
 */
const JDE = {
  id: "jde",
  name: "Final Nacional sub 14 Juegos Deportivos Escolares 2026",
  // Así viene de la API: medianoche UTC del día elegido.
  startDate: "2026-09-22T00:00:00.000Z",
  endDate: "2026-10-04T00:00:00.000Z",
  status: "ACTIVE",
};
const NUEVO = { id: "nuevo", name: "Evento nuevo", startDate: "2026-11-10T00:00:00.000Z", endDate: "2026-11-15T00:00:00.000Z", status: "DRAFT" };
const VIEJO = { id: "viejo", name: "Evento 2025", startDate: "2025-10-01T00:00:00.000Z", endDate: "2025-10-05T00:00:00.000Z", status: "ACTIVE" };
const SIN_FECHAS = { id: "sin", name: "Borrador", startDate: null, endDate: null, status: "DRAFT" };

describe("diaDeFechaEvento", () => {
  it("toma el día en UTC, que es el que se eligió en el formulario", () => {
    expect(diaDeFechaEvento("2026-09-22T00:00:00.000Z")).toBe("2026-09-22");
    expect(diaDeFechaEvento("2026-09-22")).toBe("2026-09-22");
    expect(diaDeFechaEvento(null)).toBeNull();
    expect(diaDeFechaEvento("no es fecha")).toBeNull();
  });
});

describe("etapaEvento", () => {
  it("en curso entre el primer y el último día, ambos incluidos", () => {
    expect(etapaEvento(JDE, "2026-09-22")).toBe("EN_CURSO");
    expect(etapaEvento(JDE, "2026-09-27")).toBe("EN_CURSO");
    expect(etapaEvento(JDE, "2026-10-04")).toBe("EN_CURSO");
  });
  it("próximo antes de empezar y finalizado después", () => {
    expect(etapaEvento(JDE, "2026-09-21")).toBe("PROXIMO");
    expect(etapaEvento(JDE, "2026-10-05")).toBe("FINALIZADO");
  });
  it("sin fechas no está en ninguna etapa", () => {
    expect(etapaEvento(SIN_FECHAS, "2026-09-27")).toBe("SIN_FECHAS");
  });
});

describe("eventoPorDefecto", () => {
  it("con un evento nuevo creado, sigue abriendo el que está en curso (el caso de Ariel)", () => {
    // /events los devuelve del más nuevo al más viejo: antes se abría el primero.
    expect(eventoPorDefecto([NUEVO, JDE], "2026-09-27")).toBe("jde");
  });
  it("con dos en curso, el activo antes que el borrador (World Rugby creado el 27-09)", () => {
    const RUGBY = { id: "rugby", name: "WORLD RUGBY U20 CHALLENGER CUP CHILE", startDate: "2026-09-27T00:00:00.000Z", endDate: "2026-10-18T00:00:00.000Z", status: "DRAFT" };
    expect(eventoPorDefecto([RUGBY, JDE], "2026-09-27")).toBe("jde");
    // Cuando Rugby pase a activo y los Juegos terminen, abre Rugby.
    expect(eventoPorDefecto([{ ...RUGBY, status: "ACTIVE" }, JDE], "2026-10-06")).toBe("rugby");
  });
  it("terminado el evento, abre el próximo", () => {
    expect(eventoPorDefecto([NUEVO, JDE, VIEJO], "2026-10-06")).toBe("nuevo");
  });
  it("si todos terminaron, el más reciente", () => {
    expect(eventoPorDefecto([VIEJO, JDE], "2026-12-01")).toBe("jde");
  });
  it("sin eventos no hay evento activo", () => {
    expect(eventoPorDefecto([], "2026-09-27")).toBe("");
  });
});

describe("resolverEventoActivo", () => {
  it("respeta el evento que eligió la persona aunque no sea el en curso", () => {
    expect(resolverEventoActivo([NUEVO, JDE], "nuevo", "2026-09-27")).toBe("nuevo");
  });
  it("si el elegido se borró, vuelve al en curso", () => {
    expect(resolverEventoActivo([JDE], "nuevo", "2026-09-27")).toBe("jde");
  });
  it("sin elección, el en curso", () => {
    expect(resolverEventoActivo([NUEVO, JDE], "", "2026-09-27")).toBe("jde");
  });
});

describe("ordenarEventos", () => {
  it("en curso, próximos, sin fechas y finalizados", () => {
    expect(ordenarEventos([VIEJO, SIN_FECHAS, NUEVO, JDE], "2026-09-27").map((e) => e.id)).toEqual(["jde", "nuevo", "sin", "viejo"]);
  });
});

describe("esDelEvento", () => {
  it("filtra por el evento activo", () => {
    expect(esDelEvento("jde", "jde")).toBe(true);
    expect(esDelEvento("jde", "nuevo")).toBe(false);
  });
  it("sin evento activo no filtra, y lo que no tiene evento se ve en todos", () => {
    expect(esDelEvento("", "nuevo")).toBe(true);
    expect(esDelEvento("jde", null)).toBe(true);
  });
});

describe("rangoEvento", () => {
  it("fechas cortas en español", () => {
    expect(rangoEvento(JDE)).toBe("22 sep – 4 oct 2026");
    expect(rangoEvento({ id: "x", startDate: "2026-12-28", endDate: "2027-01-03" })).toBe("28 dic 2026 – 3 ene 2027");
    expect(rangoEvento({ id: "x", startDate: "2026-11-10", endDate: null })).toBe("10 nov 2026");
    expect(rangoEvento(SIN_FECHAS)).toBe("");
  });
});

describe("hoyEnChile", () => {
  it("un instante de madrugada en UTC todavía es el día anterior en Chile", () => {
    expect(hoyEnChile(new Date("2026-09-28T02:00:00Z"))).toBe("2026-09-27");
  });
});
