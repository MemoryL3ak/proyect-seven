import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
