import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';
import { Venue } from './entities/venue.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Venue])],
  controllers: [VenuesController],
  providers: [VenuesService, SupabaseProvider],
})
export class VenuesModule {}
