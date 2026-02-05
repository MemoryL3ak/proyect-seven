import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { DisciplinesService } from './disciplines.service';
import { DisciplinesController } from './disciplines.controller';

@Module({
  controllers: [DisciplinesController],
  providers: [DisciplinesService, SupabaseProvider],
})
export class DisciplinesModule {}
