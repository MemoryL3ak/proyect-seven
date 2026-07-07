import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { SupportChatsController } from './support-chats.controller';
import { SupportChatsService } from './support-chats.service';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';

@Module({
  imports: [PushNotificationsModule],
  controllers: [SupportChatsController],
  providers: [SupportChatsService, SupabaseProvider],
})
export class SupportChatsModule {}
