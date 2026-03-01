import {
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsISO8601()
  @IsOptional()
  startDate?: string;

  @IsISO8601()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  disciplineIds?: string[];

  @IsString()
  @IsOptional()
  status?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsArray()
  @IsOptional()
  expectedCapacities?: Array<{
    disciplineId: string;
    delegationCode: string;
    expectedCount: number;
  }>;
}
