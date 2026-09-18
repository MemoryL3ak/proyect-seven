import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { MobileAuthModule } from '../mobile-auth/mobile-auth.module';
import { AuthModule } from '../auth/auth.module';
import { VehiclePositionsController } from './vehicle-positions.controller';
import { VehiclePositionsService } from './vehicle-positions.service';
import { VehiclePositionsAccessService } from './vehicle-positions.access.service';
import { VehiclePositionsGuard } from './vehicle-positions.guard';
import { TripProximityService } from './trip-proximity.service';
import { VehiclePosition } from './entities/vehicle-position.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehiclePosition]),
    PushNotificationsModule,
    MobileAuthModule,
    // StaffScopeService: acota GET /vehicle-positions a la delegación del Jefe de Misión.
    AuthModule,
  ],
  controllers: [VehiclePositionsController],
  providers: [
    VehiclePositionsService,
    VehiclePositionsAccessService,
    VehiclePositionsGuard,
    TripProximityService,
    SupabaseProvider,
  ],
})
export class VehiclePositionsModule {}
