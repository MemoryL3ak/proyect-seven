import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { AccountPurgeController } from './account-purge.controller';
import { AccountPurgeService } from './account-purge.service';

@Module({
  controllers: [AccountPurgeController],
  providers: [AccountPurgeService, SupabaseProvider],
})
export class AccountPurgeModule {}
