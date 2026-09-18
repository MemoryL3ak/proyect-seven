import { Module } from '@nestjs/common';
import { DriverPresenceController } from './driver-presence.controller';
import { DriverPresenceService } from './driver-presence.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule: StaffScopeService acota el monitoreo a la delegación del
  // Jefe de Misión.
  imports: [AuthModule],
  controllers: [DriverPresenceController],
  providers: [DriverPresenceService],
  exports: [DriverPresenceService],
})
export class DriverPresenceModule {}
