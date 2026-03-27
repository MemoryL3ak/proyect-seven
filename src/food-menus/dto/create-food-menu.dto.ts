import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';

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
}
