import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';
import { Delegation } from './entities/delegation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Delegation])],
  controllers: [DelegationsController],
  providers: [DelegationsService, SupabaseProvider],
})
export class DelegationsModule {}
