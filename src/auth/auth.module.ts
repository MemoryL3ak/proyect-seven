import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { SupabaseStrategy } from '@/supabase/strategy';
import { AuthService } from './auth.service';
import { SupabaseProvider } from '@/supabase/provider';
import { Logger } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { StaffScopeService } from './staff-scope.service';

@Module({
  imports: [ConfigModule, PassportModule],
  controllers: [AuthController],
  providers: [SupabaseStrategy, AuthService, SupabaseProvider, Logger, StaffScopeService],
  // StaffScopeService: los módulos que acotan datos por delegación (monitoreo,
  // incidencias, alimentación, calendario) lo importan vía AuthModule.
  exports: [AuthService, SupabaseStrategy, StaffScopeService],
})
export class AuthModule {}
