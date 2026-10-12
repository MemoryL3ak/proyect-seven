import { describe, expect, it } from "vitest";
import { altoEstimadoDeLista, direccionDeLista, filtrarOpciones } from "./desplegable";

describe("búsqueda dentro del desplegable", () => {
  const patentes = ["TSWT26", "VKKD92", "VKTK17", "VSKR52"].map((p) => ({ value: p, label: p }));
  const opciones = [{ value: "", label: "Sin patente" }, ...patentes, { value: "__otra__", label: "Otra patente…" }];

  it("la lista de patentes del Monitoreo (12-10-2026): escribir 'vk' deja las VK y conserva 'Otra patente…'", () => {
    expect(filtrarOpciones(opciones, "vk", ["__otra__"]).map((o) => o.value)).toEqual(["VKKD92", "VKTK17", "__otra__"]);
  });

  it("ignora mayúsculas, acentos, espacios y guiones", () => {
    expect(filtrarOpciones(opciones, "vk-kd 92").map((o) => o.value)).toEqual(["VKKD92"]);
    expect(filtrarOpciones([{ value: "nunoa", label: "Ñuñoa" }], "nuñoa").length).toBe(1);
    expect(filtrarOpciones([{ value: "x", label: "Estación Central" }], "estacion").length).toBe(1);
  });

  it("sin texto devuelve todo; sin coincidencias, sólo las fijas", () => {
    expect(filtrarOpciones(opciones, "  ")).toBe(opciones);
    expect(filtrarOpciones(opciones, "zz", ["__otra__"]).map((o) => o.value)).toEqual(["__otra__"]);
    expect(filtrarOpciones(opciones, "zz")).toEqual([]);
  });
});

describe("dirección del desplegable", () => {
  it("en la barra flotante al pie de Viajes (poco espacio abajo) la lista se abre hacia arriba", () => {
    // 6 opciones ≈ 218 px; abajo quedan 60 px y arriba 800.
    const alto = altoEstimadoDeLista(6);
    expect(alto).toBe(6 * 36 + 2);
    expect(direccionDeLista(60, 800, alto)).toBe("arriba");
  });

  it("con espacio abajo se abre hacia abajo, como siempre", () => {
    expect(direccionDeLista(400, 100, altoEstimadoDeLista(6))).toBe("abajo");
  });

  it("si no cabe en ningún lado, va donde hay más espacio", () => {
    expect(direccionDeLista(100, 150, 320)).toBe("arriba");
    expect(direccionDeLista(150, 100, 320)).toBe("abajo");
    expect(altoEstimadoDeLista(40)).toBe(320);
  });
});
