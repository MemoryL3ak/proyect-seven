import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SofiaController } from './sofia.controller';
import { SofiaService } from './sofia.service';
import { DriverPresenceModule } from '../driver-presence/driver-presence.module';
import { AuthModule } from '../auth/auth.module';
import { Event } from '../events/entities/event.entity';
import { Delegation } from '../delegations/entities/delegation.entity';
import { Athlete } from '../athletes/entities/athlete.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Transport } from '../transports/entities/transport.entity';
import { Accommodation } from '../accommodations/entities/accommodation.entity';
import { Flight } from '../flights/entities/flight.entity';
import { Provider } from '../providers/entities/provider.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      Delegation,
      Athlete,
      Trip,
      Driver,
      Transport,
      Accommodation,
      Flight,
      Provider,
    ]),
    DriverPresenceModule,
    // AuthModule: StaffScopeService decide si SofIA responde como agente del
    // panel o en modo consulta acotado a la delegación del Jefe de Misión.
    AuthModule,
  ],
  controllers: [SofiaController],
  providers: [SofiaService],
})
export class SofiaModule {}
