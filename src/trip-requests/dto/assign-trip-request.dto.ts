import { IsOptional, IsString } from 'class-validator';

/** Asignación de conductor/vehículo a una solicitud T1 o VIP. */
export class AssignTripRequestDto {
  @IsString()
  @IsOptional()
  driverId?: string;

  @IsString()
  @IsOptional()
  vehicleId?: string;

  @IsString()
  @IsOptional()
  vehiclePlate?: string;
}
