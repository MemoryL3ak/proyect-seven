import { describe, expect, it } from "vitest";
import { claveDeColumna, TITULO_COLUMNA, tituloDeColumna } from "./columnas-carga";

/**
 * 28-09-2026: las plantillas de carga masiva mostraban nombres internos
 * ("fecha_hora_llegada", "conductor_llegada"). Ahora van en español y la
 * carga acepta los dos.
 */
describe("columnas de la carga masiva", () => {
  it("la plantilla lleva títulos en español", () => {
    expect(tituloDeColumna("vuelo_llegada")).toBe("Llegada · número de vuelo");
    expect(tituloDeColumna("conductor_salida")).toBe("Salida · conductor");
    expect(tituloDeColumna("is_delegation_lead")).toBe("Jefe de delegación (SI/NO)");
  });

  it("la carga reconoce el título aunque lo escriban distinto", () => {
    expect(claveDeColumna("Llegada · número de vuelo")).toBe("vuelo_llegada");
    expect(claveDeColumna("LLEGADA - NUMERO DE VUELO")).toBe("vuelo_llegada");
    expect(claveDeColumna("llegada numero de vuelo")).toBe("vuelo_llegada");
    expect(claveDeColumna("Salida · Conductor")).toBe("conductor_salida");
  });

  it("una planilla antigua con nombres internos sigue funcionando", () => {
    expect(claveDeColumna("fecha_hora_llegada")).toBe("fecha_hora_llegada");
    expect(claveDeColumna("full_name")).toBe("full_name");
    expect(claveDeColumna("Event ID")).toBe("event_id");
  });

  it("no hay dos columnas con el mismo título", () => {
    const vistos = new Map<string, string>();
    for (const [clave, titulo] of Object.entries(TITULO_COLUMNA)) {
      const k = titulo.toLowerCase();
      expect(vistos.get(k), `"${titulo}" repetido en ${vistos.get(k)} y ${clave}`).toBeUndefined();
      vistos.set(k, clave);
    }
  });

  it("todo título vuelve a su clave", () => {
    for (const [clave, titulo] of Object.entries(TITULO_COLUMNA)) {
      expect(claveDeColumna(titulo)).toBe(clave);
    }
  });
});
