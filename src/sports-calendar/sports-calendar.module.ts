import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { SportsCalendarController } from './sports-calendar.controller';
import { SportsCalendarService } from './sports-calendar.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [SportsCalendarController],
  // AuthModule: StaffScopeService acota el calendario a la delegación del Jefe de Misión.
  imports: [AuthModule],
  providers: [SportsCalendarService, SupabaseProvider],
})
export class SportsCalendarModule {}
