import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateSalonReservationDto {
  @IsString() @IsNotEmpty() salonId: string;
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsOptional() organizerName?: string;
  @IsString() @IsOptional() organizerEmail?: string;
  @IsString() @IsOptional() eventId?: string;
  @IsString() @IsNotEmpty() startDate: string;
  @IsString() @IsNotEmpty() endDate: string;
  @IsString() @IsNotEmpty() startTime: string;
  @IsString() @IsNotEmpty() endTime: string;
  @IsInt() @Min(0) @IsOptional() attendees?: number;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() notes?: string;
}
