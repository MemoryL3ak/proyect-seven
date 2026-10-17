/**
 * Descarga de documentos desde el panel (17-10-2026, pedido de Ariel): un
 * botón por documento y otro con todos los de una persona en un .zip.
 *
 * Los archivos están en Supabase Storage y el backend entrega sus URLs
 * firmadas. Con `download=<nombre>` en la URL, el storage responde con
 * "Content-Disposition: attachment" y el navegador guarda el archivo en vez
 * de abrirlo en la pestaña.
 */
import { DOCS_CONDUCTOR, documentosRequeridos, type PersonaConDocumentos } from "@/lib/documentos-personas";

/** URL que descarga en vez de abrir, con el nombre que tendrá el archivo. */
export function urlDeDescarga(url: string, nombre: string): string {
  const separador = url.includes("?") ? "&" : "?";
  return `${url}${separador}download=${encodeURIComponent(nombre)}`;
}

/** "p1/doc_licencia-1760000000001.pdf?token=…" → "pdf". */
export function extensionDeUrl(url: string): string {
  const sinQuery = url.split("?")[0];
  const m = /\.([a-z0-9]{1,5})$/i.exec(sinQuery);
  return m ? m[1].toLowerCase() : "";
}

/** "Licencia de conducir" + ".pdf", sin caracteres que un sistema de archivos rechace. */
export function nombreDeArchivo(etiqueta: string, url: string, nombreSugerido?: string | null): string {
  if (nombreSugerido && nombreSugerido.trim()) return nombreSugerido.trim();
  const base = etiqueta.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const ext = extensionDeUrl(url);
  return ext ? `${base}.${ext}` : base;
}

export type ArchivoDePersona = { key: string; label: string; url: string; nombre: string };

/**
 * Los documentos que una persona subió, con la URL de descarga y el nombre
 * del archivo. Entran los que el panel le pide y cualquier otro `doc_*` que
 * traiga la ficha.
 */
export function archivosDePersona(p: PersonaConDocumentos, tipoProveedor?: string | null): ArchivoDePersona[] {
  const meta = p.metadata ?? {};
  const conocidos = documentosRequeridos(p, tipoProveedor);
  const etiquetaDe = new Map(DOCS_CONDUCTOR.map((d) => [d.key, d.label]));
  const claves = [
    ...conocidos.map((d) => d.key),
    ...Object.keys(meta).filter((k) => k.startsWith("doc_") && !conocidos.some((d) => d.key === k)),
  ];
  const salida: ArchivoDePersona[] = [];
  for (const key of claves) {
    const url = meta[key];
    if (typeof url !== "string" || !url) continue;
    const label = etiquetaDe.get(key) ?? key.replace(/^doc_/, "").replace(/_/g, " ");
    salida.push({ key, label, url, nombre: nombreDeArchivo(label, url) });
  }
  return salida;
}

/** Guarda un blob como archivo, con el nombre dado. */
export function guardarBlob(blob: Blob, nombre: string) {
  const enlace = document.createElement("a");
  const url = URL.createObjectURL(blob);
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // El navegador necesita un instante para empezar la descarga antes de soltar la URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
