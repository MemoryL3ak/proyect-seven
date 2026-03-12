import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { VehiclePositionsController } from './vehicle-positions.controller';
import { VehiclePositionsService } from './vehicle-positions.service';
import { VehiclePosition } from './entities/vehicle-position.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VehiclePosition])],
  controllers: [VehiclePositionsController],
  providers: [VehiclePositionsService, SupabaseProvider],
})
export class VehiclePositionsModule {}
