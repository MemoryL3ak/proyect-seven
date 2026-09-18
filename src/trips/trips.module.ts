import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TripsScheduleService } from './trips-schedule.service';
import { TripsFinanceService } from './trips-finance.service';
import { Trip } from './entities/trip.entity';
import { TripMessage } from './entities/trip-message.entity';
import { ProviderRate } from '../providers/entities/provider-rate.entity';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, TripMessage, ProviderRate]),
    PushNotificationsModule,
    // AuthModule: StaffScopeService acota los viajes a la delegación del Jefe de Misión.
    AuthModule,
  ],
  controllers: [TripsController],
  providers: [TripsService, TripsScheduleService, TripsFinanceService, SupabaseProvider],
})
export class TripsModule {}
