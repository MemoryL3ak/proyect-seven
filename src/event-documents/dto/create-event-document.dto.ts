import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { DocumentAudience } from '../entities/event-document.entity';

export const AUDIENCES: DocumentAudience[] = [
  'PARTICIPANTE',
  'VIP',
  'CONDUCTOR',
];

export class CreateEventDocumentDto {
  @IsString()
  @IsOptional()
  eventId?: string | null;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  /** Archivo en data URL (data:application/pdf;base64,...). */
  @IsString()
  @IsOptional()
  dataUrl?: string;

  /** Alternativa: enlace externo ya publicado. */
  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsArray()
  @IsIn(AUDIENCES, { each: true })
  @IsOptional()
  audiences?: DocumentAudience[];

  @IsBoolean()
  @IsOptional()
  published?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
