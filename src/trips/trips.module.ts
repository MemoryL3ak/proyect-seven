import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  controllers: [TripsController],
  providers: [TripsService, SupabaseProvider],
})
export class TripsModule {}
