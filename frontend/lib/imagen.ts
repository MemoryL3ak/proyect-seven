/**
 * Preparar una foto de cámara para subirla.
 *
 * Un teléfono saca fotos de 3 a 8 MB. Viajan en base64, que agrega un tercio,
 * contra un servidor que está a ~300 ms: la subida tardaba lo suficiente como
 * para que la persona creyera que no había pasado nada, tocara otra cosa o
 * cerrara la pantalla a mitad de camino. Reducida al lado mayor que necesita
 * una credencial, la misma foto pesa unos 200 KB.
 *
 * La orientación se toma de los datos EXIF: sin eso, las fotos verticales de
 * muchos teléfonos se suben acostadas, porque el sensor graba apaisado y deja
 * la rotación anotada aparte.
 */

const LADO_MAX = 1280;
const CALIDAD = 0.85;
/** Por debajo de esto no vale la pena recomprimir. */
const YA_ES_CHICA = 350 * 1024;

/**
 * Documentos (carnet, licencia, certificados): se leen, así que llevan más
 * resolución que una foto de credencial. A 2000 px el texto de un carnet
 * fotografiado sigue nítido y el archivo queda bajo 1 MB.
 */
const LADO_MAX_DOCUMENTO = 2000;
/**
 * Un PDF no se puede achicar en el teléfono. Sobre este peso se frena antes de
 * enviarlo: en base64 crece un tercio y por datos móviles la subida se corta
 * a mitad de camino (29-09-2026, conductores: "Load failed").
 */
export const MAX_MB_ARCHIVO = 15;

function leerComoDataUrl(archivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as string);
    lector.onerror = () => reject(new Error("No se pudo leer el archivo"));
    lector.readAsDataURL(archivo);
  });
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo abrir la imagen"));
    img.src = src;
  });
}

async function dibujable(archivo: Blob): Promise<{ fuente: CanvasImageSource; ancho: number; alto: number }> {
  // createImageBitmap aplica la orientación EXIF sin trucos de canvas, pero
  // no está en todos los WebView: si falla, se cae al <img>, que en los
  // navegadores actuales también la respeta.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
      return { fuente: bitmap, ancho: bitmap.width, alto: bitmap.height };
    } catch {
      // sigue por el camino del <img>
    }
  }
  const img = await cargarImagen(await leerComoDataUrl(archivo));
  return { fuente: img, ancho: img.naturalWidth || img.width, alto: img.naturalHeight || img.height };
}

/**
 * Devuelve la foto como data URL, reducida y en JPEG. Si algo falla por el
 * camino devuelve el archivo tal cual: más vale subir una foto pesada que no
 * subir ninguna.
 */
export async function prepararFoto(archivo: File, ladoMax = LADO_MAX): Promise<string> {
  try {
    const { fuente, ancho, alto } = await dibujable(archivo);
    const escala = Math.min(1, ladoMax / Math.max(ancho, alto));
    if (escala === 1 && archivo.size <= YA_ES_CHICA) {
      return await leerComoDataUrl(archivo);
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(ancho * escala));
    canvas.height = Math.max(1, Math.round(alto * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) return await leerComoDataUrl(archivo);
    ctx.drawImage(fuente, 0, 0, canvas.width, canvas.height);
    if (typeof (fuente as ImageBitmap).close === "function") {
      (fuente as ImageBitmap).close();
    }
    return canvas.toDataURL("image/jpeg", CALIDAD);
  } catch {
    return await leerComoDataUrl(archivo);
  }
}

/** Fotos de cualquier formato, incluidas las HEIC del iPhone que a veces llegan sin tipo. */
export function esImagen(archivo: { type?: string; name?: string }): boolean {
  if ((archivo.type || "").toLowerCase().startsWith("image/")) return true;
  return /\.(jpe?g|png|heic|heif|webp)$/i.test(archivo.name || "");
}

/** Mensaje si el archivo no se puede subir tal cual, o null si se puede. */
export function archivoMuyPesado(archivo: { size: number; type?: string; name?: string }): string | null {
  if (esImagen(archivo)) return null; // las fotos se achican antes de subir
  const mb = archivo.size / (1024 * 1024);
  if (mb <= MAX_MB_ARCHIVO) return null;
  return `El archivo pesa ${mb.toFixed(1).replace(".", ",")} MB y el máximo es ${MAX_MB_ARCHIVO} MB. Súbelo como foto o envía un PDF más liviano.`;
}

/**
 * Documento listo para subir: una foto se reduce a JPEG legible (un carnet
 * fotografiado pasa de 5-15 MB a menos de 1 MB); un PDF va tal cual, salvo
 * que pase el máximo, y entonces se avisa sin intentar la subida.
 */
export async function prepararDocumento(archivo: File): Promise<string> {
  const pesado = archivoMuyPesado(archivo);
  if (pesado) throw new Error(pesado);
  if (esImagen(archivo)) return prepararFoto(archivo, LADO_MAX_DOCUMENTO);
  return leerComoDataUrl(archivo);
}

/**
 * Qué decirle a la persona cuando una subida falla. El navegador sólo dice
 * "Load failed" (iPhone) o "Failed to fetch" cuando la conexión se corta a
 * mitad de la subida; eso no le sirve a un conductor.
 */
export function mensajeDeSubida(error: unknown, que: string): string {
  const texto = error instanceof Error ? error.message : String(error ?? "");
  if (/entity too large|payload too large|\b413\b/i.test(texto)) {
    return `${que}: el archivo es demasiado pesado. Súbelo como foto o envía un PDF más liviano.`;
  }
  if (/no se pudo conectar con la api|load failed|failed to fetch|network|networkerror|conexi[oó]n/i.test(texto)) {
    return `No se pudo subir ${que}: se cortó la conexión. Revisa la señal e intenta de nuevo.`;
  }
  if (/el archivo pesa/i.test(texto)) return texto;
  return `No se pudo subir ${que}. Intenta de nuevo.`;
}
