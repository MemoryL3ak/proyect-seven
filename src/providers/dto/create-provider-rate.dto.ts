import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProviderRateDto {
  @IsString()
  @IsNotEmpty()
  providerId: string;

  @IsString()
  @IsNotEmpty()
  fleetType: string;

  @IsString()
  @IsOptional()
  passengerRange?: string;

  @IsString()
  @IsNotEmpty()
  tripType: string;

  @IsNumber()
  @IsOptional()
  clientPrice?: number;

  @IsNumber()
  @IsOptional()
  providerPrice?: number;
}
