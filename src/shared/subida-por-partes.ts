import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Subida de documentos por partes (29-09-2026).
 *
 * Un conductor en la calle, con datos móviles, subía su SOAP (un PDF, que el
 * teléfono no puede achicar) en una sola petición de varios MB. Si la señal
 * se cortaba a mitad de camino se perdía todo y el iPhone sólo decía "Load
 * failed", tres veces seguidas. Ahora la app manda pedazos de ~512 KB, uno
 * tras otro, y reintenta sólo el que falló.
 *
 * Cada parte queda en Storage (no en memoria del servidor: así da igual qué
 * instancia atienda cada petición y un reinicio no la pierde). Con la última
 * se juntan, se sube el archivo final y se borran las partes.
 */

export const BUCKET_DOCUMENTOS = 'driver-documents';
/** Tope por parte, ya decodificada. La app manda 512 KB. */
export const MAX_BYTES_PARTE = 1024 * 1024;
/** 120 partes de 512 KB = 60 MB: más que el tope de 15 MB de la app. */
export const MAX_PARTES = 120;

export type ParteDeDocumento = {
  key: string;
  contentType: string;
  uploadId: string;
  parte: number;
  partes: number;
  /** Base64 de este pedazo del archivo. */
  datos: string;
};

export type ResultadoParte = { completo: false; recibidas: number } | { completo: true; url: string };

const RE_CLAVE = /^[A-Za-z0-9_]{1,60}$/;
const RE_SUBIDA = /^[A-Za-z0-9-]{8,64}$/;
const RE_TIPO = /^[\w.+-]+\/[\w.+-]+$/;

/** Revisa lo que manda la app; lanza 400 con qué está mal. */
export function validarParte(p: Partial<ParteDeDocumento>): ParteDeDocumento {
  const partes = Number(p?.partes);
  const parte = Number(p?.parte);
  if (!RE_CLAVE.test(String(p?.key ?? ''))) throw new BadRequestException('Documento inválido');
  if (!RE_SUBIDA.test(String(p?.uploadId ?? ''))) throw new BadRequestException('Identificador de subida inválido');
  if (!RE_TIPO.test(String(p?.contentType ?? ''))) throw new BadRequestException('Tipo de archivo inválido');
  if (!Number.isInteger(partes) || partes < 1 || partes > MAX_PARTES) {
    throw new BadRequestException('El archivo es demasiado pesado');
  }
  if (!Number.isInteger(parte) || parte < 0 || parte >= partes) throw new BadRequestException('Parte inválida');
  if (typeof p?.datos !== 'string' || p.datos.length === 0) throw new BadRequestException('Parte vacía');
  return { key: p.key!, contentType: p.contentType!, uploadId: p.uploadId!, parte, partes, datos: p.datos };
}

/** Carpeta temporal de una subida. */
export const carpetaDePartes = (dueno: string, uploadId: string) => `_partes/${dueno}/${uploadId}`;
const nombreDeParte = (i: number) => String(i).padStart(4, '0');
/** El archivo final lleva el id de la subida: si la app reintenta la última parte, se reconoce. */
export const rutaFinal = (dueno: string, p: Pick<ParteDeDocumento, 'key' | 'uploadId' | 'contentType'>) =>
  `${dueno}/${p.key}-${p.uploadId}.${p.contentType.split('/')[1]?.split('+')[0] || 'bin'}`;

/**
 * Guarda una parte; con la última arma el archivo y devuelve su URL pública
 * (el interceptor global la firma al responder, como con la subida entera).
 */
export async function recibirParte(
  admin: SupabaseClient,
  dueno: string,
  entrada: Partial<ParteDeDocumento>,
): Promise<ResultadoParte> {
  if (!/^[0-9a-f-]{36}$/i.test(dueno)) throw new BadRequestException('Persona inválida');
  const p = validarParte(entrada);
  const buffer = Buffer.from(p.datos, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_BYTES_PARTE) throw new BadRequestException('Parte inválida');

  const storage = admin.storage.from(BUCKET_DOCUMENTOS);
  const carpeta = carpetaDePartes(dueno, p.uploadId);
  const destino = rutaFinal(dueno, p);
  const { error } = await storage.upload(`${carpeta}/${nombreDeParte(p.parte)}`, buffer, {
    contentType: 'application/octet-stream',
    upsert: true,
  });
  if (error) throw new InternalServerErrorException(error.message || 'No se pudo guardar la parte');

  if (p.parte < p.partes - 1) return { completo: false, recibidas: p.parte + 1 };

  const pedazos = await Promise.all(
    Array.from({ length: p.partes }, async (_, i) => {
      const { data, error: e } = await storage.download(`${carpeta}/${nombreDeParte(i)}`);
      return e || !data ? null : Buffer.from(await data.arrayBuffer());
    }),
  );
  if (pedazos.some((x) => !x)) {
    // Reintento de la última parte cuando la primera vez sí se armó (se perdió
    // la respuesta, no la subida): el archivo final ya está.
    const { data: ya } = await storage.list(dueno, { search: `${p.key}-${p.uploadId}` });
    if ((ya ?? []).length > 0) {
      await storage.remove([`${carpeta}/${nombreDeParte(p.parte)}`]);
      return { completo: true, url: storage.getPublicUrl(destino).data.publicUrl };
    }
    throw new BadRequestException('Faltan partes del archivo; vuelve a subirlo');
  }

  const { error: eFinal } = await storage.upload(destino, Buffer.concat(pedazos as Buffer[]), {
    contentType: p.contentType,
    upsert: true,
  });
  if (eFinal) throw new InternalServerErrorException(eFinal.message || 'No se pudo guardar el documento');
  await storage.remove(Array.from({ length: p.partes }, (_, i) => `${carpeta}/${nombreDeParte(i)}`));

  const url = storage.getPublicUrl(destino).data?.publicUrl;
  if (!url) throw new InternalServerErrorException('No se pudo obtener la URL del documento');
  return { completo: true, url };
}
