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
  description?: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  clientTypes?: string[];
}
