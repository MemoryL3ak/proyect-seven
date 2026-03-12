import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { Flight } from './entities/flight.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Flight])],
  controllers: [FlightsController],
  providers: [FlightsService, SupabaseProvider],
})
export class FlightsModule {}
