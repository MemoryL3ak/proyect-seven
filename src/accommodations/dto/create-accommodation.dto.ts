import { IsInt, IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateAccommodationDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  accommodationType?: string;

  @IsString()
  @IsOptional()
  tower?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsObject()
  @IsOptional()
  geoLocation?: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @IsOptional()
  totalCapacity?: number;

  @IsObject()
  @IsOptional()
  roomInventory?: Record<string, number>;

  @IsObject()
  @IsOptional()
  bedInventory?: Record<string, number>;

  @IsISO8601()
  @IsOptional()
  checkIn?: string | null;

  @IsISO8601()
  @IsOptional()
  checkOut?: string | null;
}
