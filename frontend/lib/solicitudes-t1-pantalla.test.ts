import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 28-09-2026: "Solicitudes T1: acá falta agregar filtros, acciones para
 * reservar". Filtros de día, solicitante y conductor con el selector del
 * panel, y "+ Nueva reserva" para reservar desde la web.
 */
const pagina = readFileSync(join(__dirname, "..", "app", "(main)", "operations", "trip-requests", "page.tsx"), "utf8");

describe("Solicitudes T1/VIP", () => {
  it("filtra por día, solicitante y conductor, sin <select> nativo", () => {
    expect(pagina).toContain("setDayFilter");
    expect(pagina).toContain("setRequesterFilter");
    expect(pagina).toContain("setDriverFilter");
    expect(pagina).not.toContain('<select className="input');
  });

  it("tiene el botón y el formulario de nueva reserva", () => {
    expect(pagina).toContain('t("Nueva reserva")');
    expect(pagina).toContain("cuerpoReserva(datos, new Date())");
  });
});
