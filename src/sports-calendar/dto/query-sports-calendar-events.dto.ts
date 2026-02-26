import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class QuerySportsCalendarEventsDto {
  @IsString()
  @IsOptional()
  eventId?: string;

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
