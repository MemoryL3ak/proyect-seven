import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class QuerySportsCalendarEventsDto {
  @IsString()
  @IsOptional()
  eventId?: string;

  /** Filas donde participa esta delegación (más las generales). */
  @IsString()
  @IsOptional()
  delegationId?: string;

  @IsISO8601()
  @IsOptional()
  from?: string;

  @IsISO8601()
  @IsOptional()
  to?: string;

  @IsString()
  @IsOptional()
  sport?: string;

  @IsString()
  @IsOptional()
  league?: string;

  @IsString()
  @IsOptional()
  team?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  source?: string;
}
