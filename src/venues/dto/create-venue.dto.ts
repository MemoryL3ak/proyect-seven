import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateVenueDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  /** SEDE (por defecto) o COMEDOR. */
  @IsString()
  @IsOptional()
  venueType?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  commune?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  // Coordinador de sede: lo ven los jefes de misión junto al Coordinador General.
  @IsString()
  @IsOptional()
  coordinatorName?: string | null;

  @IsString()
  @IsOptional()
  coordinatorPhone?: string | null;
}
