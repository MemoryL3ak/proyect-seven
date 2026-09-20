import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
} from 'class-validator';

export class CreateFoodLocationDto {
  @IsString()
  @IsOptional()
  accommodationId?: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  clientTypes?: string[];

  /** Vacío o ausente = el lugar sirve a todas las regiones. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  delegationIds?: string[];

  /** Vacío o ausente = el lugar sirve a todos los deportes. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  disciplineIds?: string[];
}
