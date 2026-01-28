import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { AccommodationsController } from './accommodations.controller';
import { AccommodationsService } from './accommodations.service';

@Module({
  controllers: [AccommodationsController],
  providers: [AccommodationsService, SupabaseProvider],
})
export class AccommodationsModule {}
