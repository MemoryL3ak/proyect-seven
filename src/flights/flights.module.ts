import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';

@Module({
  controllers: [FlightsController],
  providers: [FlightsService, SupabaseProvider],
})
export class FlightsModule {}
