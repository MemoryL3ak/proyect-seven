import { IsArray, IsISO8601, IsOptional, IsString } from 'class-validator';

export class AwarderInputDto {
  @IsString()
  athleteId: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePremiacionDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  sportsEventId?: string;

  @IsOptional()
  @IsString()
  disciplineId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  discipline?: string;

  @IsISO8601()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  venueId?: string;

  @IsOptional()
  @IsString()
  venueName?: string;

  @IsOptional()
  @IsString()
  locationDetail?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  awarders?: AwarderInputDto[];
}
