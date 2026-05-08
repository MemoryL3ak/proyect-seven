import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { PushNotificationsController } from './push-notifications.controller';
import { PushNotificationsService } from './push-notifications.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PushNotificationsController],
  providers: [PushNotificationsService, SupabaseProvider],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
