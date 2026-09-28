import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { esDelEvento } from "./evento-activo";

/**
 * 28-09-2026: Claribel Fonseca (Coordinadora de Transporte de World Rugby)
 * veía en la app los 596 traslados de los Juegos Escolares en Viña, las
 * premiaciones del Estadio Elías Figueroa en su calendario y los 14 hoteles
 * de los Juegos. La app muestra sólo lo del evento de su ficha.
 */
const pagina = readFileSync(join(__dirname, "..", "app", "portal", "user", "page.tsx"), "utf8");
const JDE = "0e168c10-a7d1-47ae-9784-265a5fc25d9d";
const RUGBY = "8bbd6a39-a788-4588-9c15-7aec86080dba";

describe("app del participante: sólo el evento de su ficha", () => {
  it("un traslado de los Juegos Escolares no es de Rugby", () => {
    expect(esDelEvento(RUGBY, JDE)).toBe(false);
    expect(esDelEvento(RUGBY, RUGBY)).toBe(true);
  });

  it("filtra traslados, premiaciones y hoteles por el evento de la ficha", () => {
    expect(pagina).toContain("setDelegationTrips((Array.isArray(viajesDelegacion) ? viajesDelegacion : []).filter((v) => esDelEvento(data.eventId, v.eventId)))");
    expect(pagina).toContain("setPremiaciones((Array.isArray(prems) ? prems : []).filter((p) => esDelEvento(data.eventId, p.eventId)))");
    expect(pagina).toContain("setAllAccommodations((lista || []).filter((h) => esDelEvento(data.eventId, h.eventId)))");
  });
});
