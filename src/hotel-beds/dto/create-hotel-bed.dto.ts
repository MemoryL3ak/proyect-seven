import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHotelBedDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  bedType: string;

  @IsString()
  @IsOptional()
  status?: string;
}
