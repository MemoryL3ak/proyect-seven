import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService, SupabaseProvider],
})
export class EventsModule {}
