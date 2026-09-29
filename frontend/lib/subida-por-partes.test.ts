import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { partirDataUrl, subirPorPartes, TAM_PARTE, type ParteParaEnviar } from "./subida-por-partes";

/**
 * 29-09-2026: "No se pudo subir SOAP: se cortó la conexión", tres veces. El
 * PDF iba entero en una petición por datos móviles; ahora va en partes de
 * 512 KB y un corte repite sólo la parte que falló.
 */
const pdf = Buffer.from(Array.from({ length: 1300 * 1024 }, (_, i) => (i * 7) % 256));
const dataUrl = `data:application/pdf;base64,${pdf.toString("base64")}`;
const sinEspera = () => Promise.resolve();

describe("partir un documento", () => {
  it("cada tramo se decodifica solo y juntos dan el archivo original", () => {
    const { contentType, tramos } = partirDataUrl(dataUrl);
    expect(contentType).toBe("application/pdf");
    expect(tramos).toHaveLength(Math.ceil(pdf.length / TAM_PARTE)); // 3
    const juntos = Buffer.concat(tramos.map((t) => Buffer.from(t, "base64")));
    expect(juntos.equals(pdf)).toBe(true);
  });

  it("un archivo sin tipo sale como octet-stream", () => {
    expect(partirDataUrl("data:;base64,QUJD").contentType).toBe("application/octet-stream");
  });
});

describe("subir por partes", () => {
  it("manda las partes en orden con la misma subida y devuelve la respuesta de la última", async () => {
    const enviadas: ParteParaEnviar[] = [];
    const avance: number[] = [];
    const r = await subirPorPartes(
      dataUrl,
      async (p) => {
        enviadas.push(p);
        return p.parte === p.partes - 1 ? { metadata: { doc_soap: "https://x/soap.pdf" } } : { completo: false };
      },
      { alAvanzar: (f) => avance.push(f), esperar: sinEspera },
    );
    expect(enviadas.map((p) => p.parte)).toEqual([0, 1, 2]);
    expect(new Set(enviadas.map((p) => p.uploadId)).size).toBe(1);
    expect(r).toEqual({ metadata: { doc_soap: "https://x/soap.pdf" } });
    expect(avance.at(-1)).toBe(1);
  });

  it("un corte de señal repite sólo esa parte", async () => {
    const enviar = vi.fn(async (p: ParteParaEnviar) => p);
    enviar.mockImplementationOnce(async (p) => p); // parte 0
    enviar.mockImplementationOnce(async () => {
      throw new Error("No se pudo conectar con la API. Intentos: https://proyect-seven-production.up.railway.app: Load failed");
    });
    await subirPorPartes(dataUrl, enviar, { esperar: sinEspera });
    expect(enviar.mock.calls.map(([p]) => p.parte)).toEqual([0, 1, 1, 2]);
  });

  it("un rechazo del servidor (4xx) no se reintenta; tras 4 cortes seguidos se rinde", async () => {
    const rechazo = Object.assign(new Error("El archivo es demasiado pesado"), { status: 400 });
    const enviar400 = vi.fn(async () => { throw rechazo; });
    await expect(subirPorPartes(dataUrl, enviar400, { esperar: sinEspera })).rejects.toBe(rechazo);
    expect(enviar400).toHaveBeenCalledTimes(1);

    const enviarSinSenal = vi.fn(async () => { throw new Error("Load failed"); });
    await expect(subirPorPartes(dataUrl, enviarSinSenal, { esperar: sinEspera })).rejects.toThrow("Load failed");
    expect(enviarSinSenal).toHaveBeenCalledTimes(4);
  });

  it("el portal del conductor sube los documentos por partes, con avance en el botón", () => {
    const portal = readFileSync(join(__dirname, "..", "app", "portal", "conductor", "page.tsx"), "utf8");
    expect(portal).toContain("/document-part`");
    expect(portal).toContain("await subirPorPartes<any>(dataUrl,");
    expect(portal).toContain("{ alAvanzar: setProgresoDoc }");
  });
});
