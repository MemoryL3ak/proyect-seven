import { IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

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
