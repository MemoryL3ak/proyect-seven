import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { HotelKeysController } from './hotel-keys.controller';
import { HotelKeysService } from './hotel-keys.service';

@Module({
  controllers: [HotelKeysController],
  providers: [HotelKeysService, SupabaseProvider],
})
export class HotelKeysModule {}
