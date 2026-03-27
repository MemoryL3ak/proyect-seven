import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateHotelExtraReservationDto {
  @IsString()
  @IsNotEmpty()
  extraId: string;

  @IsString()
  @IsNotEmpty()
  participantId: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
