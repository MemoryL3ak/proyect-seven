import { Module } from '@nestjs/common';
import { SupabaseProvider } from '../supabase/provider';
import { GpsTrackersController } from './gps-trackers.controller';
import { GpsTrackersService } from './gps-trackers.service';

@Module({
  controllers: [GpsTrackersController],
  providers: [GpsTrackersService, SupabaseProvider],
  exports: [GpsTrackersService],
})
export class GpsTrackersModule {}
