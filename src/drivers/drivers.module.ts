import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  controllers: [DriversController],
  providers: [DriversService, SupabaseProvider],
})
export class DriversModule {}
