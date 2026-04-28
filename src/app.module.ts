import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { TransportsModule } from './transports/transports.module';
import { TripsModule } from './trips/trips.module';
import { DriversModule } from './drivers/drivers.module';
import { FlightsModule } from './flights/flights.module';
import { AccommodationsModule } from './accommodations/accommodations.module';
import { EventsModule } from './events/events.module';
import { DelegationsModule } from './delegations/delegations.module';
import { VehiclePositionsModule } from './vehicle-positions/vehicle-positions.module';
import { AthletesModule } from './athletes/athletes.module';
import { DisciplinesModule } from './disciplines/disciplines.module';
import { ProvidersModule } from './providers/providers.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SofiaModule } from './sofia/sofia.module';
import { HotelRoomsModule } from './hotel-rooms/hotel-rooms.module';
import { HotelBedsModule } from './hotel-beds/hotel-beds.module';
import { HotelAssignmentsModule } from './hotel-assignments/hotel-assignments.module';
import { SportsCalendarModule } from './sports-calendar/sports-calendar.module';
import { AccreditationsModule } from './accreditations/accreditations.module';
import { VenuesModule } from './venues/venues.module';
import { HotelKeysModule } from './hotel-keys/hotel-keys.module';
import { SalonesModule } from './salones/salones.module';
import { HotelExtrasModule } from './hotel-extras/hotel-extras.module';
import { HotelExtraReservationsModule } from './hotel-extra-reservations/hotel-extra-reservations.module';
import { FoodLocationsModule } from './food-locations/food-locations.module';
import { FoodMenusModule } from './food-menus/food-menus.module';
import { ProviderParticipantsModule } from './provider-participants/provider-participants.module';
import { MobileAuthModule } from './mobile-auth/mobile-auth.module';
import { AccessControlModule } from './access-control/access-control.module';
import { PremiacionesModule } from './premiaciones/premiaciones.module';
import { SupportChatsModule } from './support-chats/support-chats.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('DATABASE_URL') ?? '';
        const needsSsl =
          configService.get<string>('DB_SSL') === 'true' ||
          /supabase\.(co|com)/.test(url);
        return {
          type: 'postgres',
          url,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          ssl: needsSsl ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    AuthModule,
    TransportsModule,
    TripsModule,
    DriversModule,
    FlightsModule,
    AccommodationsModule,
    EventsModule,
    DelegationsModule,
    VehiclePositionsModule,
    AthletesModule,
    DisciplinesModule,
    ProvidersModule,
    SofiaModule,
    HotelRoomsModule,
    HotelBedsModule,
    HotelAssignmentsModule,
    HotelKeysModule,
    SalonesModule,
    HotelExtrasModule,
    HotelExtraReservationsModule,
    FoodLocationsModule,
    FoodMenusModule,
    ProviderParticipantsModule,
    SportsCalendarModule,
    AccreditationsModule,
    VenuesModule,
    MobileAuthModule,
    AccessControlModule,
    PremiacionesModule,
    SupportChatsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
