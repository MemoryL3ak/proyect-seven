import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { HotelBedsController } from './hotel-beds.controller';
import { HotelBedsService } from './hotel-beds.service';

@Module({
  controllers: [HotelBedsController],
  providers: [HotelBedsService, SupabaseProvider],
})
export class HotelBedsModule {}
