import { IsISO8601, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateVehiclePositionDto {
  @IsString()
  @IsOptional()
  eventId?: string;

  @IsString()
  @IsOptional()
  vehicleId?: string;

  @IsString()
  @IsNotEmpty()
  driverId: string;

  // Optional: if the caller doesn't supply it, the service resolves the
  // driver's active trip and stamps it automatically.
  @IsString()
  @IsOptional()
  tripId?: string;

  @IsISO8601()
  timestamp: string;

  @IsObject()
  location: Record<string, unknown>;

  @IsNumber()
  @IsOptional()
  speed?: number;

  @IsNumber()
  @IsOptional()
  heading?: number;
}
