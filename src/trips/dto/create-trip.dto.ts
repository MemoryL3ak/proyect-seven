import { IsArray, IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateTripDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  driverId: string;

  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @IsString()
  @IsOptional()
  destination?: string;

  @IsString()
  @IsOptional()
  origin?: string;

  @IsString()
  @IsOptional()
  tripType?: string;

  @IsString()
  @IsOptional()
  clientType?: string;

  @IsNumber()
  @IsOptional()
  tripCost?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  athleteIds?: string[];

  @IsString()
  @IsOptional()
  status?: string;

  @IsObject()
  @IsOptional()
  routeGeometry?: Record<string, unknown>;

  @IsISO8601()
  @IsOptional()
  scheduledAt?: string;

  @IsISO8601()
  @IsOptional()
  startedAt?: string;

  @IsISO8601()
  @IsOptional()
  completedAt?: string;
}
