import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { AccommodationsController } from './accommodations.controller';
import { AccommodationsService } from './accommodations.service';
import { Accommodation } from './entities/accommodation.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule: StaffScopeService acota los hoteles a la delegación del Jefe de Misión.
  imports: [TypeOrmModule.forFeature([Accommodation]), AuthModule],
  controllers: [AccommodationsController],
  providers: [AccommodationsService, SupabaseProvider],
})
export class AccommodationsModule {}
