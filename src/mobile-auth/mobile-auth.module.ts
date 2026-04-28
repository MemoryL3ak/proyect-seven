import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseProvider } from '@/supabase/provider';
import { MobileAuthService } from './mobile-auth.service';
import { MobileAuthController } from './mobile-auth.controller';

@Module({
  imports: [ConfigModule],
  controllers: [MobileAuthController],
  providers: [MobileAuthService, SupabaseProvider, Logger],
  exports: [MobileAuthService],
})
export class MobileAuthModule {}
