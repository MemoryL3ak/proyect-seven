import { IsIn, IsOptional, IsString } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  @IsIn(['athlete', 'driver', 'admin', 'provider_participant'])
  userKind: string;

  @IsString()
  userId: string;

  @IsString()
  @IsIn(['ios', 'android'])
  platform: string;

  @IsString()
  expoToken: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class UnregisterTokenDto {
  @IsString()
  expoToken: string;
}
