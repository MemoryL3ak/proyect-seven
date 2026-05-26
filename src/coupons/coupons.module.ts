import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { CouponPartnersController } from './coupon-partners.controller';
import { CouponPartnersService } from './coupon-partners.service';
import { PartnerAuthGuard } from './partner-auth.guard';

@Module({
  controllers: [CouponsController, CouponPartnersController],
  providers: [
    CouponsService,
    CouponPartnersService,
    PartnerAuthGuard,
    SupabaseProvider,
  ],
})
export class CouponsModule {}
