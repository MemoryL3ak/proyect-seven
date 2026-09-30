import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { destinoTrasLogin } from "./destino-login";

/**
 * 30-09-2026: estando en Proveedores se terminaba en el dashboard. Una causa:
 * al vencer la sesión, el login volvía siempre al inicio aunque supiera de
 * dónde venía (?next=).
 */
describe("a dónde vuelve el login", () => {
  it("a la página donde estaba", () => {
    expect(destinoTrasLogin("?expired=1&next=%2Fregistro%2Fproveedores")).toBe("/registro/proveedores");
    expect(destinoTrasLogin("?next=%2Foperations%2Ftrips%3Fdia%3D2026-09-30")).toBe("/operations/trips?dia=2026-09-30");
  });

  it("nunca fuera del panel ni al login de nuevo", () => {
    expect(destinoTrasLogin("")).toBe("/");
    expect(destinoTrasLogin("?next=https%3A%2F%2Fotro.sitio")).toBe("/");
    expect(destinoTrasLogin("?next=%2F%2Fotro.sitio")).toBe("/");
    expect(destinoTrasLogin("?next=%2Flogin%3Fexpired%3D1")).toBe("/");
  });

  it("el login lo usa en los dos caminos (entrar y cambiar la clave temporal)", () => {
    const login = readFileSync(join(__dirname, "..", "app", "(auth)", "login", "page.tsx"), "utf8");
    expect(login.match(/router\.push\(destinoTrasLogin\(window\.location\.search\)\)/g)).toHaveLength(2);
    expect(login).not.toContain('router.push("/")');
  });

  it("rastreo: el aviso de otro día no salta si el vuelo llega el día pedido", () => {
    const panel = readFileSync(join(__dirname, "..", "app", "(main)", "operations", "flights", "page.tsx"), "utf8");
    expect(panel).toContain("![trackResult.depScheduled?.slice(0, 10), trackResult.arrScheduled?.slice(0, 10)].includes(trackResult.requestedDate)");
  });
});
