import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { VehiclePositionsController } from './vehicle-positions.controller';
import { VehiclePositionsService } from './vehicle-positions.service';

@Module({
  controllers: [VehiclePositionsController],
  providers: [VehiclePositionsService, SupabaseProvider],
})
export class VehiclePositionsModule {}
