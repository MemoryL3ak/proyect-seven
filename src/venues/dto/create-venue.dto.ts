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

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  commune?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;
}
