import { IsOptional, IsString } from 'class-validator';

export class ReturnHotelKeyDto {
  @IsString()
  @IsOptional()
  actorName?: string;

  @IsString()
  @IsOptional()
  returnedAt?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
