import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateProviderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  subtype?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  rut?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
