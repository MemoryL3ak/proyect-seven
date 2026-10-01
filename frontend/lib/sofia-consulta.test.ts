import { describe, expect, it } from "vitest";
import { cuerpoConsultaSofia } from "./sofia-consulta";

describe("cuerpoConsultaSofia", () => {
  it("manda el evento en pantalla junto con la pregunta", () => {
    expect(cuerpoConsultaSofia({ question: "¿Cuántos viajes hay hoy?", previousResponseId: "r1", locale: "es", eventoId: "rugby" })).toEqual({
      question: "¿Cuántos viajes hay hoy?",
      previousResponseId: "r1",
      locale: "es",
      eventId: "rugby",
    });
  });

  it("en el portal, sin evento en pantalla, no manda eventId", () => {
    expect(cuerpoConsultaSofia({ question: "hola", previousResponseId: null, locale: "es", eventoId: null })).toEqual({ question: "hola", locale: "es" });
  });
});
