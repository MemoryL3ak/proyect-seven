import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { AuthModule } from '../auth/auth.module';
import { MobileAuthModule } from '../mobile-auth/mobile-auth.module';
import { AthletesService } from './athletes.service';
import { AthletesController } from './athletes.controller';
import { Athlete } from './entities/athlete.entity';

@Module({
  // AuthModule: StaffScopeService, para invalidar el alcance del Jefe de Misión
  // cuando cambia is_delegation_lead o la delegación de un participante.
  imports: [TypeOrmModule.forFeature([Athlete]), MobileAuthModule, AuthModule],
  controllers: [AthletesController],
  providers: [AthletesService, SupabaseProvider],
})
export class AthletesModule {}
