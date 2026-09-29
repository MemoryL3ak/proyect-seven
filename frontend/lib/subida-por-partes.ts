/**
 * Subir un documento en pedazos (29-09-2026).
 *
 * El SOAP de un conductor, un PDF que el teléfono no puede achicar, fallaba
 * tres veces seguidas con "se cortó la conexión": iba entero en una sola
 * petición de varios MB por datos móviles, y cualquier corte de señal la
 * perdía completa. Ahora va en partes de 512 KB, una tras otra; si una se
 * corta, se reintenta esa sola. El servidor las junta al recibir la última
 * (src/shared/subida-por-partes.ts).
 */

/** Bytes por parte. Múltiplo de 3: cada tramo de base64 se decodifica solo. */
export const TAM_PARTE = 3 * 174_762; // 524.286 bytes ≈ 512 KB
const CHARS_POR_PARTE = (TAM_PARTE / 3) * 4;

export type ParteParaEnviar = {
  contentType: string;
  uploadId: string;
  parte: number;
  partes: number;
  datos: string;
};

/** Parte un data URL en tramos de base64 que el servidor decodifica por separado. */
export function partirDataUrl(dataUrl: string): { contentType: string; tramos: string[] } {
  const coma = dataUrl.indexOf(",");
  const cabecera = coma > 0 ? dataUrl.slice(0, coma) : "";
  if (!cabecera.startsWith("data:") || !cabecera.endsWith(";base64")) throw new Error("No se pudo leer el archivo");
  const contentType = cabecera.slice(5).split(";")[0] || "application/octet-stream";
  const base64 = dataUrl.slice(coma + 1);
  const tramos: string[] = [];
  for (let i = 0; i < base64.length; i += CHARS_POR_PARTE) tramos.push(base64.slice(i, i + CHARS_POR_PARTE));
  if (tramos.length === 0) throw new Error("El archivo está vacío");
  return { contentType, tramos };
}

/** Se reintenta un corte de red o un error del servidor; no un 4xx (el archivo no sirve). */
export function valeReintentar(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return typeof status !== "number" || status >= 500;
}

const nuevaSubida = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Manda las partes en orden y devuelve lo que responde la última (la ficha
 * con el documento ya guardado). Cada parte tiene hasta `intentos` intentos,
 * con esperas crecientes para que la señal vuelva.
 */
export async function subirPorPartes<T>(
  dataUrl: string,
  enviar: (parte: ParteParaEnviar) => Promise<T>,
  opciones: {
    alAvanzar?: (fraccion: number) => void;
    intentos?: number;
    esperar?: (ms: number) => Promise<void>;
    uploadId?: string;
  } = {},
): Promise<T> {
  const { contentType, tramos } = partirDataUrl(dataUrl);
  const uploadId = opciones.uploadId ?? nuevaSubida();
  const intentos = opciones.intentos ?? 4;
  const esperar = opciones.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let ultima: T | undefined;
  opciones.alAvanzar?.(0);
  for (let i = 0; i < tramos.length; i++) {
    for (let intento = 1; ; intento++) {
      try {
        ultima = await enviar({ contentType, uploadId, parte: i, partes: tramos.length, datos: tramos[i] });
        break;
      } catch (error) {
        if (intento >= intentos || !valeReintentar(error)) throw error;
        await esperar(1500 * 2 ** (intento - 1)); // 1,5 s, 3 s, 6 s
      }
    }
    opciones.alAvanzar?.((i + 1) / tramos.length);
  }
  return ultima as T;
}
