import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DataSource } from 'typeorm';

/**
 * Inventario de todo lo que se ha subido a la plataforma: fotos de hoteles,
 * recintos, conductores y participantes, documentos de conductores,
 * proveedores y del evento, fichas médicas.
 *
 * No existe una tabla de archivos: cada módulo guarda la URL en su propia
 * columna o dentro de su `metadata`. Este servicio junta esas referencias,
 * las cruza con lo que hay físicamente en los buckets de Supabase Storage y
 * entrega una sola lista, con el archivo que ninguna tabla nombra (huérfano)
 * y la referencia cuyo archivo ya no está (rota).
 */

/** Buckets donde la plataforma sube archivos. */
export const BUCKETS = [
  'venue-photos',
  'athlete-photos',
  'athlete-health-docs',
  'driver-photos',
  'driver-documents',
  'provider-documents',
  'event-documents',
] as const;

export type TipoArchivo = 'FOTO' | 'DOCUMENTO' | 'OTRO';
export type EstadoArchivo = 'REFERENCIADO' | 'HUERFANO' | 'ROTO' | 'SIN_VERIFICAR';

export type ArchivoAdmin = {
  bucket: string;
  path: string;
  nombre: string;
  /** URL pública canónica; el interceptor global la firma si el bucket es privado. */
  url: string;
  tipo: TipoArchivo;
  /** "Foto de hotel", "Documento de conductor · Licencia de conducir"… */
  categoria: string;
  entidadTipo: string | null;
  entidadId: string | null;
  entidadNombre: string | null;
  /** Pantalla del panel donde vive la entidad. */
  entidadRuta: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  creadoEn: string | null;
  estado: EstadoArchivo;
};

export type ResumenBucket = {
  bucket: string;
  total: number;
  bytes: number;
  huerfanos: number;
  rotos: number;
};

export type InventarioArchivos = {
  generadoEn: string;
  /** false cuando no se pudo leer el storage: sólo se listan las referencias. */
  storageVerificado: boolean;
  total: number;
  totalBytes: number;
  buckets: ResumenBucket[];
  archivos: ArchivoAdmin[];
};

type Referencia = Omit<ArchivoAdmin, 'url' | 'estado' | 'nombre' | 'contentType' | 'sizeBytes' | 'creadoEn'> & {
  nombre?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  creadoEn?: string | null;
};

type ObjetoStorage = {
  bucket: string;
  path: string;
  sizeBytes: number | null;
  contentType: string | null;
  creadoEn: string | null;
};

const PUBLIC_MARKER = '/storage/v1/object/public/';
const SIGN_MARKER = '/storage/v1/object/sign/';
const BUCKET_SET = new Set<string>(BUCKETS);

/** Etiquetas de los documentos del conductor (mismas claves que el panel). */
const DOC_LABELS: Record<string, string> = {
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

const IMAGEN_RE = /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i;
const DOCUMENTO_RE = /\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i;

/** `.../storage/v1/object/public/<bucket>/<path>` → { bucket, path }. */
export function parsearReferencia(value: unknown): { bucket: string; path: string } | null {
  if (typeof value !== 'string' || !value) return null;
  if (value.startsWith('data:')) return null;
  const marker = value.includes(PUBLIC_MARKER) ? PUBLIC_MARKER : value.includes(SIGN_MARKER) ? SIGN_MARKER : null;
  if (!marker) return null;
  const rest = value.slice(value.indexOf(marker) + marker.length).split('?')[0];
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  let path = rest.slice(slash + 1);
  try {
    path = decodeURIComponent(path);
  } catch {
    // ruta con % sueltos: se deja tal cual
  }
  if (!BUCKET_SET.has(bucket) || !path) return null;
  return { bucket, path };
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const tipoPorNombre = (path: string, contentType?: string | null): TipoArchivo => {
  const ct = String(contentType ?? '').toLowerCase();
  if (ct.startsWith('image/')) return 'FOTO';
  if (ct === 'application/pdf' || ct.startsWith('application/vnd') || ct.startsWith('text/')) return 'DOCUMENTO';
  if (IMAGEN_RE.test(path)) return 'FOTO';
  if (DOCUMENTO_RE.test(path)) return 'DOCUMENTO';
  return 'OTRO';
};

@Injectable()
export class AdminFilesService {
  private readonly logger = new Logger(AdminFilesService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private supabaseUrl(): string {
    return String(this.configService.get<string>('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  }

  private getAdminClient(): SupabaseClient | null {
    const url = this.supabaseUrl();
    const key =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? this.configService.get<string>('SUPABASE_KEY');
    if (!url || !key) return null;
    return createClient(url, key);
  }

  private urlPublica(bucket: string, path: string): string {
    const codificada = path
      .split('/')
      .map((parte) => encodeURIComponent(parte))
      .join('/');
    return `${this.supabaseUrl()}${PUBLIC_MARKER}${bucket}/${codificada}`;
  }

  async listar(): Promise<InventarioArchivos> {
    const [referencias, objetos] = await Promise.all([this.referencias(), this.objetosStorage()]);
    const storageVerificado = objetos !== null;

    const porClave = new Map<string, ObjetoStorage>();
    for (const objeto of objetos ?? []) porClave.set(`${objeto.bucket}/${objeto.path}`, objeto);

    const referenciados = new Set<string>();
    const archivos: ArchivoAdmin[] = [];

    for (const ref of referencias) {
      const clave = `${ref.bucket}/${ref.path}`;
      const objeto = porClave.get(clave);
      referenciados.add(clave);
      const contentType = objeto?.contentType ?? ref.contentType ?? null;
      archivos.push({
        bucket: ref.bucket,
        path: ref.path,
        nombre: ref.nombre || ref.path.split('/').pop() || ref.path,
        url: this.urlPublica(ref.bucket, ref.path),
        tipo: ref.tipo === 'OTRO' ? tipoPorNombre(ref.path, contentType) : ref.tipo,
        categoria: ref.categoria,
        entidadTipo: ref.entidadTipo,
        entidadId: ref.entidadId,
        entidadNombre: ref.entidadNombre,
        entidadRuta: ref.entidadRuta,
        contentType,
        sizeBytes: objeto?.sizeBytes ?? ref.sizeBytes ?? null,
        creadoEn: objeto?.creadoEn ?? ref.creadoEn ?? null,
        estado: !storageVerificado ? 'SIN_VERIFICAR' : objeto ? 'REFERENCIADO' : 'ROTO',
      });
    }

    // Lo que está en el storage y ninguna tabla nombra: subidas viejas que se
    // reemplazaron (los módulos suben con upsert y nunca borran la anterior)
    // o de registros ya eliminados.
    for (const objeto of objetos ?? []) {
      const clave = `${objeto.bucket}/${objeto.path}`;
      if (referenciados.has(clave)) continue;
      archivos.push({
        bucket: objeto.bucket,
        path: objeto.path,
        nombre: objeto.path.split('/').pop() || objeto.path,
        url: this.urlPublica(objeto.bucket, objeto.path),
        tipo: tipoPorNombre(objeto.path, objeto.contentType),
        categoria: this.categoriaPorRuta(objeto.bucket, objeto.path),
        entidadTipo: null,
        entidadId: null,
        entidadNombre: null,
        entidadRuta: null,
        contentType: objeto.contentType,
        sizeBytes: objeto.sizeBytes,
        creadoEn: objeto.creadoEn,
        estado: 'HUERFANO',
      });
    }

    archivos.sort((a, b) => String(b.creadoEn ?? '').localeCompare(String(a.creadoEn ?? '')));

    const buckets = new Map<string, ResumenBucket>();
    for (const bucket of BUCKETS) buckets.set(bucket, { bucket, total: 0, bytes: 0, huerfanos: 0, rotos: 0 });
    for (const archivo of archivos) {
      const resumen = buckets.get(archivo.bucket) ?? { bucket: archivo.bucket, total: 0, bytes: 0, huerfanos: 0, rotos: 0 };
      resumen.total += 1;
      resumen.bytes += archivo.sizeBytes ?? 0;
      if (archivo.estado === 'HUERFANO') resumen.huerfanos += 1;
      if (archivo.estado === 'ROTO') resumen.rotos += 1;
      buckets.set(archivo.bucket, resumen);
    }

    return {
      generadoEn: new Date().toISOString(),
      storageVerificado,
      total: archivos.length,
      totalBytes: archivos.reduce((acc, a) => acc + (a.sizeBytes ?? 0), 0),
      buckets: [...buckets.values()],
      archivos,
    };
  }

  /** Qué es un archivo huérfano, deducido de dónde está guardado. */
  private categoriaPorRuta(bucket: string, path: string): string {
    switch (bucket) {
      case 'venue-photos':
        return path.startsWith('hotels/') ? 'Foto de hotel (sin referencia)' : 'Foto de recinto (sin referencia)';
      case 'athlete-photos':
        return 'Foto de participante (sin referencia)';
      case 'athlete-health-docs':
        return 'Documento médico (sin referencia)';
      case 'driver-photos':
        return path.startsWith('journey/') ? 'Foto de jornada (sin referencia)' : 'Foto de conductor (sin referencia)';
      case 'driver-documents':
        return 'Documento de conductor (sin referencia)';
      case 'provider-documents':
        return 'Documento de proveedor (sin referencia)';
      case 'event-documents':
        return 'Documento del evento (sin referencia)';
      default:
        return 'Archivo (sin referencia)';
    }
  }

  // ── Storage ──────────────────────────────────────────────────────────────

  /**
   * Todo lo que hay en los buckets. Primero por SQL sobre `storage.objects`,
   * que trae los siete buckets en una consulta; si el rol de la base no
   * alcanza a esa tabla, se recorre cada bucket con el API de Storage.
   * Devuelve null si ninguna de las dos formas funciona.
   */
  private async objetosStorage(): Promise<ObjetoStorage[] | null> {
    try {
      const rows = await this.dataSource.query<
        Array<{ bucket_id: string; name: string; created_at: string | Date | null; metadata: unknown }>
      >(
        `select bucket_id, name, created_at, metadata
           from storage.objects
          where bucket_id = any($1)`,
        [[...BUCKETS]],
      );
      return rows
        .filter((row) => row.name && !row.name.endsWith('/.emptyFolderPlaceholder'))
        .map((row) => {
          const meta = asRecord(row.metadata);
          const size = Number(meta.size ?? meta.contentLength ?? NaN);
          return {
            bucket: row.bucket_id,
            path: row.name,
            sizeBytes: Number.isFinite(size) ? size : null,
            contentType: typeof meta.mimetype === 'string' ? meta.mimetype : null,
            creadoEn: row.created_at ? new Date(row.created_at).toISOString() : null,
          };
        });
    } catch (error) {
      this.logger.warn(
        `No se pudo leer storage.objects por SQL, se recorre por API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const admin = this.getAdminClient();
    if (!admin) return null;
    const todos: ObjetoStorage[] = [];
    for (const bucket of BUCKETS) {
      try {
        await this.recorrerBucket(admin, bucket, '', todos, 0);
      } catch (error) {
        this.logger.warn(`No se pudo listar ${bucket}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    }
    return todos;
  }

  private async recorrerBucket(
    admin: SupabaseClient,
    bucket: string,
    prefix: string,
    salida: ObjetoStorage[],
    profundidad: number,
  ): Promise<void> {
    if (profundidad > 5) return;
    const limit = 1000;
    for (let offset = 0; ; offset += limit) {
      const { data, error } = await admin.storage.from(bucket).list(prefix, { limit, offset });
      if (error) throw new Error(error.message);
      for (const entry of data ?? []) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!entry.id) {
          // Carpeta virtual: se baja un nivel.
          await this.recorrerBucket(admin, bucket, path, salida, profundidad + 1);
          continue;
        }
        if (entry.name === '.emptyFolderPlaceholder') continue;
        const meta = asRecord(entry.metadata);
        const size = Number(meta.size ?? NaN);
        salida.push({
          bucket,
          path,
          sizeBytes: Number.isFinite(size) ? size : null,
          contentType: typeof meta.mimetype === 'string' ? meta.mimetype : null,
          creadoEn: entry.created_at ?? null,
        });
      }
      if ((data ?? []).length < limit) return;
    }
  }

  // ── Referencias en la base ───────────────────────────────────────────────

  private async consultar<T>(descripcion: string, sql: string): Promise<T[]> {
    try {
      return await this.dataSource.query<T[]>(sql);
    } catch (error) {
      this.logger.warn(`No se pudieron leer ${descripcion}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async referencias(): Promise<Referencia[]> {
    const salida: Referencia[] = [];
    const agregar = (
      valor: unknown,
      datos: Omit<Referencia, 'bucket' | 'path'>,
    ) => {
      const ref = parsearReferencia(valor);
      if (!ref) return;
      salida.push({ ...datos, bucket: ref.bucket, path: ref.path });
    };

    const [hoteles, recintos, conductores, participantesProveedor, proveedores, atletas, documentos] = await Promise.all([
      this.consultar<{ id: string; name: string; photo_url: string }>(
        'hoteles',
        `select id, name, photo_url from logistics.accommodations where photo_url is not null and photo_url <> ''`,
      ),
      this.consultar<{ id: string; name: string; photo_url: string }>(
        'recintos',
        `select id, name, photo_url from logistics.venues where photo_url is not null and photo_url <> ''`,
      ),
      this.consultar<{ id: string; full_name: string; photo_url: string | null; metadata: unknown }>(
        'conductores',
        `select id, full_name, photo_url, metadata from transport.drivers`,
      ),
      this.consultar<{ id: string; full_name: string; metadata: unknown }>(
        'participantes de proveedor',
        `select id, full_name, metadata from core.provider_participants`,
      ),
      this.consultar<{ id: string; name: string; metadata: unknown }>(
        'proveedores',
        `select id, name, metadata from core.providers`,
      ),
      this.consultar<{ id: string; full_name: string; metadata: unknown }>(
        'participantes',
        `select id, full_name, metadata from core.athletes where status is distinct from 'DELETED'`,
      ),
      this.consultar<{
        id: string;
        title: string;
        file_name: string | null;
        file_url: string;
        content_type: string | null;
        size_bytes: number | string | null;
        created_at: string | Date | null;
      }>(
        'documentos del evento',
        `select id, title, file_name, file_url, content_type, size_bytes, created_at from core.event_documents`,
      ),
    ]);

    for (const h of hoteles) {
      agregar(h.photo_url, {
        tipo: 'FOTO',
        categoria: 'Foto de hotel',
        entidadTipo: 'hotel',
        entidadId: h.id,
        entidadNombre: h.name,
        entidadRuta: '/masters/accommodations',
      });
    }
    for (const r of recintos) {
      agregar(r.photo_url, {
        tipo: 'FOTO',
        categoria: 'Foto de recinto',
        entidadTipo: 'recinto',
        entidadId: r.id,
        entidadNombre: r.name,
        entidadRuta: '/masters/venues',
      });
    }
    for (const c of conductores) {
      const base = { entidadTipo: 'conductor', entidadId: c.id, entidadNombre: c.full_name, entidadRuta: '/masters/drivers' };
      agregar(c.photo_url, { ...base, tipo: 'FOTO', categoria: 'Foto de conductor' });
      this.agregarMetadata(asRecord(c.metadata), base, 'conductor', agregar);
    }
    for (const p of participantesProveedor) {
      const base = {
        entidadTipo: 'participante_proveedor',
        entidadId: p.id,
        entidadNombre: p.full_name,
        entidadRuta: '/registro/proveedores',
      };
      const meta = asRecord(p.metadata);
      agregar(meta.photoUrl, { ...base, tipo: 'FOTO', categoria: 'Foto de participante de proveedor' });
      this.agregarMetadata(meta, base, 'participante de proveedor', agregar);
    }
    for (const p of proveedores) {
      const meta = asRecord(p.metadata);
      for (const [clave, valor] of Object.entries(meta)) {
        agregar(valor, {
          tipo: 'OTRO',
          categoria: `Documento de proveedor · ${DOC_LABELS[clave] ?? clave}`,
          entidadTipo: 'proveedor',
          entidadId: p.id,
          entidadNombre: p.name,
          entidadRuta: '/masters/providers',
        });
      }
    }
    for (const a of atletas) {
      const meta = asRecord(a.metadata);
      const base = {
        entidadTipo: 'participante',
        entidadId: a.id,
        entidadNombre: a.full_name,
        entidadRuta: '/registro/participantes',
      };
      agregar(meta.photoUrl, { ...base, tipo: 'FOTO', categoria: 'Foto de participante' });
      const salud = asRecord(meta.healthRecord);
      const rutaMedica = typeof salud.medicalDocumentPath === 'string' ? salud.medicalDocumentPath.trim() : '';
      if (rutaMedica) {
        salida.push({
          ...base,
          bucket: 'athlete-health-docs',
          path: rutaMedica.replace(/^\/+/, ''),
          tipo: 'DOCUMENTO',
          categoria: 'Documento médico',
          creadoEn: typeof salud.medicalDocumentUploadedAt === 'string' ? salud.medicalDocumentUploadedAt : null,
        });
      } else {
        agregar(salud.medicalDocumentUrl, { ...base, tipo: 'DOCUMENTO', categoria: 'Documento médico' });
      }
    }
    for (const d of documentos) {
      const size = d.size_bytes == null ? null : Number(d.size_bytes);
      agregar(d.file_url, {
        tipo: 'OTRO',
        categoria: 'Documento del evento',
        entidadTipo: 'documento_evento',
        entidadId: d.id,
        entidadNombre: d.title,
        entidadRuta: '/operations/documentos',
        nombre: d.file_name,
        contentType: d.content_type,
        sizeBytes: Number.isFinite(size as number) ? size : null,
        creadoEn: d.created_at ? new Date(d.created_at).toISOString() : null,
      });
    }
    return salida;
  }

  /** Documentos `doc_*` y fotos de jornada `jornada_*` guardados en metadata. */
  private agregarMetadata(
    meta: Record<string, unknown>,
    base: { entidadTipo: string; entidadId: string; entidadNombre: string; entidadRuta: string },
    quien: string,
    agregar: (valor: unknown, datos: Omit<Referencia, 'bucket' | 'path'>) => void,
  ) {
    for (const [clave, valor] of Object.entries(meta)) {
      if (clave.startsWith('doc_')) {
        agregar(valor, {
          ...base,
          tipo: 'OTRO',
          categoria: `Documento de ${quien} · ${DOC_LABELS[clave] ?? clave}`,
        });
        continue;
      }
      if (clave.startsWith('jornada_')) {
        const jornada = asRecord(valor);
        const fecha = clave.slice('jornada_'.length).replace(/_(start|end)$/, '');
        const momento = clave.endsWith('_end') ? 'fin' : 'inicio';
        agregar(typeof valor === 'string' ? valor : jornada.url, {
          ...base,
          tipo: 'FOTO',
          categoria: `Foto de jornada (${momento}) · ${fecha}`,
          creadoEn: typeof jornada.uploadedAt === 'string' ? jornada.uploadedAt : null,
        });
      }
    }
  }
}
