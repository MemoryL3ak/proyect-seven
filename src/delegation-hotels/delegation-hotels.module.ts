import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DelegationHotelsController } from './delegation-hotels.controller';
import { DelegationHotelsService } from './delegation-hotels.service';

@Module({
  // AuthModule: StaffScopeService, para dejar leer la planilla al Coordinador
  // de Comité sin abrirle la escritura.
  imports: [AuthModule],
  controllers: [DelegationHotelsController],
  providers: [DelegationHotelsService],
})
export class DelegationHotelsModule {}
