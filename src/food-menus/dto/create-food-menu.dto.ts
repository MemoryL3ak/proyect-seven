import { IsArray, IsString, IsOptional, IsDateString, IsIn } from 'class-validator';

export class CreateFoodMenuDto {
  @IsDateString()
  date: string;

  @IsString()
  @IsIn(['DESAYUNO', 'ALMUERZO', 'CENA'])
  mealType: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  dietaryType?: string;

  @IsString()
  @IsOptional()
  accommodationId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  clientTypes?: string[];

  @IsString()
  @IsOptional()
  venueId?: string;

  @IsString()
  @IsOptional()
  locationDetail?: string;

  /** Evento del menú o comedor (28-09-2026); sin evento se ve en todos. */
  @IsString()
  @IsOptional()
  eventId?: string;
}
