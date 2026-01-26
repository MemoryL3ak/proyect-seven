import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { SupabaseStrategy } from '@/supabase/strategy';
import { AuthService } from './auth.service';
import { SupabaseProvider } from '@/supabase/provider';
import { Logger } from '@nestjs/common';
import { AuthController } from './auth.controller';

@Module({
  imports: [ConfigModule, PassportModule],
  controllers: [AuthController],
  providers: [SupabaseStrategy, AuthService, SupabaseProvider, Logger],
  exports: [AuthService, SupabaseStrategy],
})
export class AuthModule {}
