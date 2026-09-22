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
export async function prepararFoto(archivo: File): Promise<string> {
  try {
    const { fuente, ancho, alto } = await dibujable(archivo);
    const escala = Math.min(1, LADO_MAX / Math.max(ancho, alto));
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
