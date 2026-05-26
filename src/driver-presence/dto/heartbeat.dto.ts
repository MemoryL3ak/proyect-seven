import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class HeartbeatDto {
  @IsString()
  @IsNotEmpty()
  driverId: string;

  @IsString()
  @IsOptional()
  eventId?: string;

  @IsString()
  @IsOptional()
  appVersion?: string;

  @IsString()
  @IsOptional()
  platform?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;
}
