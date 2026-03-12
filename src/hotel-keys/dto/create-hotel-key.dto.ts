import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateHotelKeyDto {
  @IsString()
  @IsNotEmpty()
  hotelId: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsOptional()
  bedId?: string;

  @IsString()
  @IsNotEmpty()
  keyNumber: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  copyNumber?: number;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
