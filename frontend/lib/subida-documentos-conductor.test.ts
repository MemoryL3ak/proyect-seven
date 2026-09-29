import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { archivoMuyPesado, esImagen, mensajeDeSubida, prepararDocumento, MAX_MB_ARCHIVO } from "./imagen";

/**
 * 29-09-2026: conductores en iPhone no podían subir sus documentos ("Error:
 * No se pudo conectar con la API. Intentos: …railway.app: Load failed
 * Fotocopia Carnet"). La app mandaba la foto original (5-15 MB, un tercio
 * más en base64) y por datos móviles la subida se cortaba; sobre 50 MB el
 * servidor además contestaba sin CORS y el teléfono no sabía por qué.
 */
const MB = 1024 * 1024;
const portal = readFileSync(join(__dirname, "..", "app", "portal", "conductor", "page.tsx"), "utf8");

describe("subida de documentos del conductor", () => {
  it("las fotos (también HEIC sin tipo) se reconocen para achicarlas antes de subir", () => {
    expect(esImagen({ type: "image/jpeg", name: "IMG_0001.JPG" })).toBe(true);
    expect(esImagen({ type: "", name: "IMG_0002.HEIC" })).toBe(true);
    expect(esImagen({ type: "application/pdf", name: "carnet.pdf" })).toBe(false);
  });

  it("una foto enorme no se frena (se reduce); un PDF sobre el máximo sí, con un mensaje claro", () => {
    expect(archivoMuyPesado({ size: 40 * MB, type: "image/jpeg", name: "IMG.JPG" })).toBeNull();
    expect(archivoMuyPesado({ size: 3 * MB, type: "application/pdf", name: "carnet.pdf" })).toBeNull();
    expect(archivoMuyPesado({ size: 22.4 * MB, type: "application/pdf", name: "carnet.pdf" })).toBe(
      `El archivo pesa 22,4 MB y el máximo es ${MAX_MB_ARCHIVO} MB. Súbelo como foto o envía un PDF más liviano.`,
    );
  });

  it("un PDF demasiado pesado no se intenta subir", async () => {
    const pdf = new File([new Uint8Array((MAX_MB_ARCHIVO + 1) * MB)], "carnet.pdf", { type: "application/pdf" });
    await expect(prepararDocumento(pdf)).rejects.toThrow(/El archivo pesa 16,0 MB/);
  });

  it("el error del reporte se muestra como un mensaje que el conductor entiende", () => {
    const error = new Error(
      "No se pudo conectar con la API. Intentos: https://proyect-seven-production.up.railway.app: Load failed",
    );
    expect(mensajeDeSubida(error, "Fotocopia Carnet")).toBe(
      "No se pudo subir Fotocopia Carnet: se cortó la conexión. Revisa la señal e intenta de nuevo.",
    );
    expect(mensajeDeSubida(new Error("request entity too large"), "Fotocopia Carnet")).toBe(
      "Fotocopia Carnet: el archivo es demasiado pesado. Súbelo como foto o envía un PDF más liviano.",
    );
  });

  it("el portal del conductor (web y app) ya no sube archivos sin reducir", () => {
    expect(portal).not.toContain("readAsDataURL");
    expect(portal).toContain("await prepararDocumento(file)");
    expect(portal).toContain("mensajeDeSubida(err, doc.label)");
    expect(portal.match(/await prepararFoto\(file\)/g)?.length).toBe(2); // foto de perfil y de jornada
  });
});
