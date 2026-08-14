import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createClient } from '@supabase/supabase-js';
import { Repository } from 'typeorm';
import { CreateEventDocumentDto } from './dto/create-event-document.dto';
import { UpdateEventDocumentDto } from './dto/update-event-document.dto';
import {
  DocumentAudience,
  EventDocument,
} from './entities/event-document.entity';

const BUCKET = 'event-documents';

@Injectable()
export class EventDocumentsService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(EventDocument)
    private readonly repository: Repository<EventDocument>,
  ) {}

  private getAdminClient() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!supabaseUrl || !serviceRoleKey) return null;
    return createClient(supabaseUrl, serviceRoleKey);
  }

  /** Sube un data URL al bucket y devuelve la URL pública y el peso en bytes. */
  private async uploadDataUrl(dataUrl: string, fileName?: string | null) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match) throw new BadRequestException('Archivo inválido');

    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    // 40 MB: el body de la API admite 50 MB en base64, que son ~37 MB reales.
    if (buffer.byteLength > 40 * 1024 * 1024)
      throw new BadRequestException('El archivo supera los 40 MB');

    const extension =
      contentType.split('/')[1]?.split('+')[0]?.toLowerCase() || 'bin';
    const safeName = (fileName ?? '')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .slice(0, 60);
    const path = `${Date.now()}-${safeName || 'documento'}.${extension}`;

    const admin = this.getAdminClient();
    if (!admin)
      throw new InternalServerErrorException(
        'SUPABASE_SERVICE_ROLE_KEY es necesaria para subir documentos',
      );

    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: true });
    if (error)
      throw new InternalServerErrorException(
        error.message || 'Error al subir el documento',
      );

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    if (!data?.publicUrl)
      throw new InternalServerErrorException(
        'No se pudo resolver la URL del documento',
      );

    return {
      fileUrl: data.publicUrl,
      contentType,
      sizeBytes: buffer.byteLength,
    };
  }

  async create(dto: CreateEventDocumentDto) {
    let fileUrl = dto.fileUrl ?? null;
    let contentType: string | null = null;
    let sizeBytes: number | null = null;

    if (dto.dataUrl) {
      const uploaded = await this.uploadDataUrl(dto.dataUrl, dto.fileName);
      fileUrl = uploaded.fileUrl;
      contentType = uploaded.contentType;
      sizeBytes = uploaded.sizeBytes;
    }
    if (!fileUrl)
      throw new BadRequestException('Debes adjuntar un archivo o un enlace');

    const document = this.repository.create({
      eventId: dto.eventId || null,
      title: dto.title,
      description: dto.description ?? null,
      category: dto.category || 'INFORMATIVO',
      fileUrl,
      fileName: dto.fileName ?? null,
      contentType,
      sizeBytes,
      audiences: dto.audiences?.length
        ? dto.audiences
        : (['PARTICIPANTE', 'VIP', 'CONDUCTOR'] as DocumentAudience[]),
      published: dto.published ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.repository.save(document);
  }

  /**
   * Lista documentos. Sin filtros devuelve todo (uso administrativo); los
   * portales llaman con `audience` y `eventId` para recibir sólo lo suyo.
   */
  async findAll(params: { eventId?: string; audience?: string } = {}) {
    const query = this.repository
      .createQueryBuilder('doc')
      .orderBy('doc.sortOrder', 'ASC')
      .addOrderBy('doc.createdAt', 'DESC');

    if (params.audience) {
      const audience = params.audience.toUpperCase();
      query
        .andWhere('doc.published = true')
        .andWhere(':audience = ANY(doc.audiences)', { audience });
      // Los documentos sin evento son transversales a todos los eventos.
      if (params.eventId) {
        query.andWhere('(doc.eventId = :eventId OR doc.eventId IS NULL)', {
          eventId: params.eventId,
        });
      }
    } else if (params.eventId) {
      query.andWhere('doc.eventId = :eventId', { eventId: params.eventId });
    }

    return query.getMany();
  }

  async findOne(id: string) {
    const document = await this.repository.findOne({ where: { id } });
    if (!document)
      throw new NotFoundException(`No existe el documento ${id}`);
    return document;
  }

  async update(id: string, dto: UpdateEventDocumentDto) {
    const document = await this.findOne(id);

    if (dto.dataUrl) {
      const uploaded = await this.uploadDataUrl(
        dto.dataUrl,
        dto.fileName ?? document.fileName,
      );
      document.fileUrl = uploaded.fileUrl;
      document.contentType = uploaded.contentType;
      document.sizeBytes = uploaded.sizeBytes;
    } else if (dto.fileUrl !== undefined) {
      document.fileUrl = dto.fileUrl;
    }

    if (dto.eventId !== undefined) document.eventId = dto.eventId || null;
    if (dto.title !== undefined) document.title = dto.title;
    if (dto.description !== undefined)
      document.description = dto.description ?? null;
    if (dto.category !== undefined)
      document.category = dto.category || 'INFORMATIVO';
    if (dto.fileName !== undefined) document.fileName = dto.fileName ?? null;
    if (dto.audiences !== undefined && dto.audiences.length)
      document.audiences = dto.audiences;
    if (dto.published !== undefined) document.published = dto.published;
    if (dto.sortOrder !== undefined) document.sortOrder = dto.sortOrder;

    return this.repository.save(document);
  }

  async remove(id: string) {
    const document = await this.findOne(id);
    // El archivo del bucket se conserva: puede estar enlazado en otro lado y
    // el costo de almacenamiento es despreciable frente a perder el original.
    await this.repository.remove(document);
    return document;
  }
}
