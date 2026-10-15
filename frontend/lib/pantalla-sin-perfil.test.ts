import { describe, expect, it } from "vitest";
import { pantallaSinPerfil } from "./pantalla-sin-perfil";

describe("portal del conductor sin perfil cargado (15-10-2026: en la app salía el login web)", () => {
  it("en el navegador sigue el login web", () => {
    expect(pantallaSinPerfil(false, false)).toBe("login-web");
    expect(pantallaSinPerfil(false, true)).toBe("login-web");
  });

  it("en la app con la sesión guardada se reintenta, no se pide el código de nuevo", () => {
    expect(pantallaSinPerfil(true, true)).toBe("reintentar");
  });

  it("en la app sin sesión va al login de la app, nunca al web", () => {
    expect(pantallaSinPerfil(true, false)).toBe("login-app");
  });
});
