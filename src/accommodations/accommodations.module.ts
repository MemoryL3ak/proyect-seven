import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { AccommodationsController } from './accommodations.controller';
import { AccommodationsService } from './accommodations.service';
import { Accommodation } from './entities/accommodation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Accommodation])],
  controllers: [AccommodationsController],
  providers: [AccommodationsService, SupabaseProvider],
})
export class AccommodationsModule {}
