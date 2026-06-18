import { Controller, Get, Query } from '@nestjs/common';
import { FleetService } from './fleet.service';

@Controller('fleet')
export class FleetController {
  constructor(private readonly service: FleetService) {}

  /** Snapshot de disponibilidad de conductores y vehículos en tiempo real. */
  @Get('availability')
  availability(@Query('eventId') eventId?: string) {
    return this.service.availability(eventId);
  }
}
