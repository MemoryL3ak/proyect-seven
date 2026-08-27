import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { VehiclePositionsController } from './vehicle-positions.controller';
import { VehiclePositionsService } from './vehicle-positions.service';
import { TripProximityService } from './trip-proximity.service';
import { VehiclePosition } from './entities/vehicle-position.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehiclePosition]),
    PushNotificationsModule,
  ],
  controllers: [VehiclePositionsController],
  providers: [VehiclePositionsService, TripProximityService, SupabaseProvider],
})
export class VehiclePositionsModule {}
