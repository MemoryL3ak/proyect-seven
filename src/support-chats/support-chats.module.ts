import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { SupportChatsController } from './support-chats.controller';
import { SupportChatsService } from './support-chats.service';

@Module({
  controllers: [SupportChatsController],
  providers: [SupportChatsService, SupabaseProvider],
})
export class SupportChatsModule {}
