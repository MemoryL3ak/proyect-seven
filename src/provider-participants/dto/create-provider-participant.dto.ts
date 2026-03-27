import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateProviderParticipantDto {
  @IsUUID()
  @IsNotEmpty()
  providerId: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsOptional()
  rut?: string;

  @IsString()
  @IsOptional()
  countryCode?: string;

  @IsString()
  @IsOptional()
  passportNumber?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  userType?: string;

  @IsBoolean()
  @IsOptional()
  visaRequired?: boolean;

  @IsString()
  @IsOptional()
  tripType?: string;

  @IsString()
  @IsOptional()
  flightNumber?: string;

  @IsString()
  @IsOptional()
  airline?: string;

  @IsString()
  @IsOptional()
  origin?: string;

  @IsString()
  @IsOptional()
  arrivalTime?: string;

  @IsString()
  @IsOptional()
  departureTime?: string;

  @IsString()
  @IsOptional()
  observations?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
