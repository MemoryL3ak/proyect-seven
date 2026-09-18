import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { AuthModule } from '../auth/auth.module';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';
import { Delegation } from './entities/delegation.entity';

@Module({
  // AuthModule: StaffScopeService, para invalidar el alcance al cambiar el Jefe de Misión.
  imports: [TypeOrmModule.forFeature([Delegation]), AuthModule],
  controllers: [DelegationsController],
  providers: [DelegationsService, SupabaseProvider],
})
export class DelegationsModule {}
