import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export const MEAL_TIME_BLOCK_TYPES = ['DESAYUNO', 'ALMUERZO', 'COLACION', 'CENA'] as const;

/** "HH:MM", que es como lo entrega y lo espera la API. */
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateMealTimeBlockDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsIn(MEAL_TIME_BLOCK_TYPES as unknown as string[])
  mealType: string;

  /** null o ausente = bloque general de todos los días. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string | null;

  @Matches(HORA)
  startsAt: string;

  @Matches(HORA)
  endsAt: string;

  @IsString()
  @IsOptional()
  note?: string | null;
}

export class UpdateMealTimeBlockDto {
  @IsIn(MEAL_TIME_BLOCK_TYPES as unknown as string[])
  @IsOptional()
  mealType?: string;

  @IsOptional()
  date?: string | null;

  @Matches(HORA)
  @IsOptional()
  startsAt?: string;

  @Matches(HORA)
  @IsOptional()
  endsAt?: string;

  @IsString()
  @IsOptional()
  note?: string | null;
}
