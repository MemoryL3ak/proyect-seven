import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, SupabaseProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
