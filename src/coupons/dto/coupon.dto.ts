import {
  IsArray,
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsString()
  title: string;

  @IsOptional() @IsString() eventId?: string;
  @IsOptional() @IsString() description?: string;

  @IsOptional()
  @IsIn(['COMIDA', 'ENTRETENIMIENTO', 'TIENDA', 'OTHER'])
  category?: string;

  @IsOptional()
  @IsIn(['PERCENTAGE', 'AMOUNT', 'FREE', 'TEXT'])
  discountType?: string;

  @IsOptional() @IsNumber() @Min(0) discountValue?: number;
  @IsOptional() @IsString() termsAndConditions?: string;
  @IsOptional() @IsString() partnerName?: string;
  @IsOptional() @IsString() partnerLogoUrl?: string;
  @IsOptional() @IsString() partnerAddress?: string;
  @IsOptional() @IsISO8601() validFrom?: string;
  @IsOptional() @IsISO8601() validUntil?: string;
  @IsOptional() @IsInt() @Min(1) maxRedemptions?: number;
  @IsOptional() @IsInt() @Min(1) perUserLimit?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  audience?: string[];

  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() imageUrl?: string;
}

export class UpdateCouponDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() eventId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() discountType?: string;
  @IsOptional() @IsNumber() @Min(0) discountValue?: number;
  @IsOptional() @IsString() termsAndConditions?: string;
  @IsOptional() @IsString() partnerName?: string;
  @IsOptional() @IsString() partnerLogoUrl?: string;
  @IsOptional() @IsString() partnerAddress?: string;
  @IsOptional() @IsISO8601() validFrom?: string;
  @IsOptional() @IsISO8601() validUntil?: string;
  @IsOptional() @IsInt() @Min(1) maxRedemptions?: number;
  @IsOptional() @IsInt() @Min(1) perUserLimit?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) audience?: string[];
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() imageUrl?: string;
}

export class RedeemCouponDto {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() userType?: string;
  @IsOptional() @IsString() userName?: string;
  @IsOptional() @IsString() redeemedBy?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() notes?: string;
}
