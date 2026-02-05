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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
      }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
