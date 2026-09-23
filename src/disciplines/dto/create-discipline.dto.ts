import {
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDisciplineDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  eventId?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsISO8601()
  @IsOptional()
  scheduledAt?: string;

  @IsString()
  @IsOptional()
  venueName?: string;

  /** Delegaciones que participan (partido: las dos regiones). Vacío = general. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  delegationIds?: string[];

  /** Partido, grupo, jornada, salida/retorno al hotel, etc. */
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
