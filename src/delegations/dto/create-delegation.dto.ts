import { IsNotEmpty, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class CreateDelegationDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  countryCode: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
