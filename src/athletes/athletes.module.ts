import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { AthletesService } from './athletes.service';
import { AthletesController } from './athletes.controller';

@Module({
  controllers: [AthletesController],
  providers: [AthletesService, SupabaseProvider],
})
export class AthletesModule {}
