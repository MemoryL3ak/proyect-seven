import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { AccreditationsController } from './accreditations.controller';
import { AccreditationsService } from './accreditations.service';

@Module({
  controllers: [AccreditationsController],
  providers: [AccreditationsService, SupabaseProvider],
})
export class AccreditationsModule {}
