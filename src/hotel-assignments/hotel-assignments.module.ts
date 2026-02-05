import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { HotelAssignmentsController } from './hotel-assignments.controller';
import { HotelAssignmentsService } from './hotel-assignments.service';

@Module({
  controllers: [HotelAssignmentsController],
  providers: [HotelAssignmentsService, SupabaseProvider],
})
export class HotelAssignmentsModule {}
