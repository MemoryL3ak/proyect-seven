import { IsOptional, IsString } from 'class-validator';

export class ClaimCouponDto {
  @IsString()
  userId: string;

  @IsOptional() @IsString() userType?: string;
  @IsOptional() @IsString() userName?: string;
  @IsOptional() @IsString() userEmail?: string;
}

export class ConfirmRedeemDto {
  @IsString()
  token: string; // qr_token (preferido) o unique_code

  @IsOptional() @IsString() redeemedBy?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() notes?: string;
}
