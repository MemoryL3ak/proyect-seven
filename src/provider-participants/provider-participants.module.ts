import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { ProviderParticipantsController } from './provider-participants.controller';
import { ProviderParticipantsService } from './provider-participants.service';
import { ProviderParticipant } from './entities/provider-participant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProviderParticipant])],
  controllers: [ProviderParticipantsController],
  providers: [ProviderParticipantsService, SupabaseProvider],
})
export class ProviderParticipantsModule {}
