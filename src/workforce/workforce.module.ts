import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { WorkforceController } from './workforce.controller';
import { WorkforceService } from './workforce.service';

@Module({
  controllers: [WorkforceController],
  providers: [WorkforceService, SupabaseProvider],
})
export class WorkforceModule {}
