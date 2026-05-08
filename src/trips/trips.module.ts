import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { Trip } from './entities/trip.entity';
import { TripMessage } from './entities/trip-message.entity';
import { ProviderRate } from '../providers/entities/provider-rate.entity';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, TripMessage, ProviderRate]),
    PushNotificationsModule,
  ],
  controllers: [TripsController],
  providers: [TripsService, SupabaseProvider],
})
export class TripsModule {}
