import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class PartnerLoginDto {
  @IsString()
  code: string;

  @IsString()
  @Length(4, 12)
  pin: string;
}

export class CreatePartnerDto {
  @IsString() code: string;
  @IsString() name: string;

  @IsString() @MinLength(4) pin: string;

  @IsOptional() @IsString() eventId?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() contactPhone?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  allowedCouponIds?: string[];

  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdatePartnerDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() name?: string;

  // Si viene, se rehashea
  @IsOptional() @IsString() @MinLength(4) pin?: string;

  @IsOptional() @IsString() eventId?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() contactPhone?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  allowedCouponIds?: string[];

  @IsOptional() @IsBoolean() active?: boolean;
}
