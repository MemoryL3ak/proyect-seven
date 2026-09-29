import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { permisosDesdeMetadata, veCobros } from "./permisos-panel";

/**
 * 29-09-2026: el Comité de World Rugby veía "Valor $180.000" en el detalle
 * del viaje, que es lo que se le cobra. El servidor ya no se lo manda
 * (src/auth/ocultar-cobros.spec.ts); acá no quedan casillas "Valor" vacías.
 */
const leer = (...ruta: string[]) => readFileSync(join(__dirname, "..", ...ruta), "utf8");

describe("valor del viaje en el panel", () => {
  it("lo ve quien tiene Finanzas; el Comité no", () => {
    const comite = permisosDesdeMetadata({ modules: ["operacion.viajes", "calendario"], soloVer: ["operacion.viajes"] });
    const bvan = permisosDesdeMetadata({ modules: ["operacion.viajes", "operacion.finanzas"], soloVer: [] });
    expect(veCobros(comite)).toBe(false);
    expect(veCobros(bvan)).toBe(true);
    expect(veCobros(permisosDesdeMetadata({}))).toBe(true); // administradores
  });

  it("exportación de Viajes, detalle de Monitoreo y formulario sólo lo muestran con Finanzas", () => {
    expect(leer("app", "(main)", "operations", "trips", "page.tsx")).toContain(
      '...(usuarioVeCobros() ? { [t("Valor")]: trip.tripCost ?? "" } : {}),',
    );
    expect(leer("app", "(main)", "operations", "vehicle-positions", "page.tsx")).toContain(
      '{usuarioVeCobros() && stat("Valor",',
    );
    expect(leer("components", "ResourceScreen.tsx")).toContain(
      '(field.key !== "tripCost" || veCobros)',
    );
  });
});
