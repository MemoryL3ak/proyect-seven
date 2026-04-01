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
