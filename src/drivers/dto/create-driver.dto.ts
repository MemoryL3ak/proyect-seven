import {
  IsEmail,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDriverDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  rut: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  providerId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  vehicleId?: string;

  @IsString()
  @IsOptional()
  vehiclePlate?: string;

  @IsString()
  @IsOptional()
  vehicleType?: string;

  @IsString()
  @IsOptional()
  vehicleStatus?: string;

  @IsString()
  @IsOptional()
  vehicleBrand?: string;

  @IsString()
  @IsOptional()
  vehicleModel?: string;

  @IsInt()
  @IsOptional()
  vehicleCapacity?: number;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsString()
  @IsOptional()
  accreditationStatus?: string;

  @IsISO8601()
  @IsOptional()
  accreditationValidatedAt?: string;

  @IsString()
  @IsOptional()
  accreditationValidatedBy?: string;

  @IsString()
  @IsOptional()
  accreditationNotes?: string;

  @IsString()
  @IsOptional()
  credentialCode?: string;

  @IsISO8601()
  @IsOptional()
  credentialIssuedAt?: string;

  @IsString()
  @IsOptional()
  credentialIssuedBy?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
