import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';

@Module({
  controllers: [DelegationsController],
  providers: [DelegationsService, SupabaseProvider],
})
export class DelegationsModule {}
