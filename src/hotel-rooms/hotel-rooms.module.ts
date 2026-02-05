import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { HotelRoomsController } from './hotel-rooms.controller';
import { HotelRoomsService } from './hotel-rooms.service';

@Module({
  controllers: [HotelRoomsController],
  providers: [HotelRoomsService, SupabaseProvider],
})
export class HotelRoomsModule {}
