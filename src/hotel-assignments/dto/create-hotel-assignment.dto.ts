import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHotelAssignmentDto {
  @IsString()
  @IsNotEmpty()
  participantId: string;

  @IsString()
  @IsNotEmpty()
  hotelId: string;

  @IsString()
  @IsOptional()
  roomId?: string;

  @IsString()
  @IsOptional()
  bedId?: string;

  @IsString()
  @IsOptional()
  checkinAt?: string;

  @IsString()
  @IsOptional()
  checkoutAt?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
