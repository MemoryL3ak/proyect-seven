import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { AccessControlController } from './access-control.controller';
import { AccessControlService } from './access-control.service';

@Module({
  controllers: [AccessControlController],
  providers: [AccessControlService, SupabaseProvider],
})
export class AccessControlModule {}
