import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { ChatBlocksController } from './chat-blocks.controller';
import { ChatBlocksService } from './chat-blocks.service';

@Module({
  controllers: [ChatBlocksController],
  providers: [ChatBlocksService, SupabaseProvider],
})
export class ChatBlocksModule {}
