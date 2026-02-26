import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { SportsCalendarController } from './sports-calendar.controller';
import { SportsCalendarService } from './sports-calendar.service';

@Module({
  controllers: [SportsCalendarController],
  providers: [SportsCalendarService, SupabaseProvider],
})
export class SportsCalendarModule {}
