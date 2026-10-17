/**
 * Descarga de los documentos de una persona de proveedor (17-10-2026, pedido
 * de Ariel: "un botón que me permita descargar por documento y otro que
 * descargue todos los documentos por usuario"). Los archivos viven como URL
 * en la metadata de la ficha bajo las claves `doc_*` (ver
 * frontend/lib/documentos-personas.ts); acá se decide qué entra al .zip y
 * con qué nombre. Sin base de datos: la lectura del storage la hace el
 * servicio.
 */
import { parsearReferencia } from '../admin-files/admin-files.service';

/** Mismas etiquetas que el panel (frontend/lib/documentos-personas.ts). */
export const ETIQUETAS_DOCUMENTO: Record<string, string> = {
  doc_carnet: 'Fotocopia carnet',
  doc_antecedentes: 'Certificado de antecedentes',
  doc_inhabilidades: 'Certificado de inhabilidades',
  doc_licencia: 'Licencia de conducir',
  doc_foto_carnet: 'Foto tipo carnet',
  doc_permiso_circ: 'Permiso de circulación',
  doc_soap: 'SOAP',
  doc_decreto_80: 'Decreto 80',
  doc_gases: 'Revisión de gases',
  doc_padron: 'Padrón',
  doc_seguro_adicional: 'Seguros adicionales',
  doc_foto_vehiculo: 'Foto del vehículo',
};

export type ArchivoDeDocumento = {
  clave: string;
  etiqueta: string;
  bucket: string;
  path: string;
  /** Nombre dentro del .zip: "Licencia de conducir.pdf". */
  nombre: string;
};

/** Extensión del archivo guardado ("<id>/doc_licencia-1700000000000.pdf" → "pdf"). */
export const extensionDe = (path: string): string => {
  const m = /\.([a-z0-9]{1,5})$/i.exec(path.split('?')[0]);
  return m ? m[1].toLowerCase() : 'bin';
};

/** Un nombre de archivo que cualquier sistema acepta, sin perder tildes. */
export const nombreSeguro = (texto: string): string =>
  texto.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Los documentos subidos por la persona, en el orden en que el panel los
 * pide (primero los personales, después los del vehículo), con el nombre que
 * llevarán dentro del .zip.
 */
export function archivosDeDocumentos(metadata: Record<string, unknown> | null | undefined): ArchivoDeDocumento[] {
  const meta = metadata ?? {};
  const claves = [
    ...Object.keys(ETIQUETAS_DOCUMENTO),
    ...Object.keys(meta).filter((k) => k.startsWith('doc_') && !(k in ETIQUETAS_DOCUMENTO)),
  ];
  const salida: ArchivoDeDocumento[] = [];
  for (const clave of claves) {
    const ref = parsearReferencia(meta[clave]);
    if (!ref) continue;
    const etiqueta = ETIQUETAS_DOCUMENTO[clave] ?? clave.replace(/^doc_/, '').replace(/_/g, ' ');
    salida.push({
      clave,
      etiqueta,
      bucket: ref.bucket,
      path: ref.path,
      nombre: `${nombreSeguro(etiqueta)}.${extensionDe(ref.path)}`,
    });
  }
  return salida;
}

/** "documentos_Carlos-Hernandez.zip": sin tildes ni espacios, por el encabezado HTTP. */
export function nombreDelZip(nombrePersona: string | null | undefined): string {
  const base = (nombrePersona ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `documentos_${base || 'persona'}.zip`;
}
