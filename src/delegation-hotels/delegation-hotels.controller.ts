import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { StaffOnly } from '../auth/staff-only.decorator';
import { CeldaHotel, DelegationHotelsService } from './delegation-hotels.service';

/** Planilla de alojamiento por delegación y disciplina (sólo personal del panel). */
@StaffOnly()
@Controller('delegation-hotels')
export class DelegationHotelsController {
  constructor(private readonly service: DelegationHotelsService) {}

  @Get()
  findByEvent(@Query('eventId') eventId: string) {
    return this.service.findByEvent(eventId);
  }

  @Put()
  saveMany(@Body() body: { eventId: string; cells: CeldaHotel[] }) {
    return this.service.saveMany(body?.eventId, body?.cells ?? []);
  }

  /** Baja la planilla a la ficha de cada participante. */
  @Post('apply')
  apply(@Body() body: { eventId: string }) {
    return this.service.applyToParticipants(body?.eventId);
  }
}
