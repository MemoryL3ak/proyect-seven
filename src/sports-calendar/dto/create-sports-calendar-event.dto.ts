import {
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSportsCalendarEventDto {
  @IsString()
  @IsOptional()
  eventId?: string;

  @IsString()
  @IsNotEmpty()
  sport: string;

  @IsString()
  @IsNotEmpty()
  league: string;

  @IsString()
  @IsOptional()
  season?: string;

  @IsString()
  @IsOptional()
  homeTeam?: string;

  @IsString()
  @IsOptional()
  awayTeam?: string;

  @IsString()
  @IsOptional()
  competitorA?: string;

  @IsString()
  @IsOptional()
  competitorB?: string;

  @IsString()
  @IsOptional()
  venue?: string;

  @IsISO8601()
  @IsNotEmpty()
  startAtUtc: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsOptional()
  scoreHome?: number;

  @IsNumber()
  @IsOptional()
  scoreAway?: number;

  @IsString()
  @IsOptional()
  externalId?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
