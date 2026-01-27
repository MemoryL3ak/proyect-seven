import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFlightDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  flightNumber: string;

  @IsString()
  @IsNotEmpty()
  airline: string;

  @IsISO8601()
  arrivalTime: string;

  @IsString()
  @IsNotEmpty()
  origin: string;

  @IsString()
  @IsOptional()
  terminal?: string;
}
