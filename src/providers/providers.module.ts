import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

@Module({
  controllers: [ProvidersController],
  providers: [ProvidersService, SupabaseProvider],
})
export class ProvidersModule {}
