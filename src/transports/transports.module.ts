import { Module } from '@nestjs/common';
import { TransportsService } from './transports.service';
import { TransportsController } from './transports.controller';
import { SupabaseProvider } from '@/supabase/provider';

@Module({
  controllers: [TransportsController],
  providers: [TransportsService, SupabaseProvider],
})
export class TransportsModule {}
