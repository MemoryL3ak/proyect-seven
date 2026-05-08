import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { PushNotificationsController } from './push-notifications.controller';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  controllers: [PushNotificationsController],
  providers: [PushNotificationsService, SupabaseProvider],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
