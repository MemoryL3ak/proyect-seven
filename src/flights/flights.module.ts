import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { AeroDataBoxProvider } from './aerodatabox.provider';
import { FlightAwareProvider } from './flightaware.provider';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { Flight } from './entities/flight.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule: StaffScopeService decide quién ve los vuelos del evento.
  imports: [TypeOrmModule.forFeature([Flight]), AuthModule],
  controllers: [FlightsController],
  providers: [FlightsService, SupabaseProvider, AeroDataBoxProvider, FlightAwareProvider],
})
export class FlightsModule {}
