import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateHotelKeyStatusDto {
  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsOptional()
  actorName?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
