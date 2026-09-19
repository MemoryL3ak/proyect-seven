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

  /** Cuántos participantes hay en una región + deporte. */
  @Get('group-count')
  contarGrupo(
    @Query('eventId') eventId: string,
    @Query('delegationId') delegationId: string,
    @Query('disciplineId') disciplineId: string,
  ) {
    return this.service.contarGrupo(eventId, delegationId, disciplineId);
  }

  /** Deja a toda una selección (región + deporte) en un hotel. */
  @Post('assign-group')
  assignGroup(
    @Body()
    body: {
      eventId: string;
      delegationId: string;
      disciplineId: string;
      accommodationId: string;
      branch?: 'DAMAS' | 'VARONES';
    },
  ) {
    return this.service.assignGroup(body);
  }

  /** Baja la planilla a la ficha de cada participante. */
  @Post('apply')
  apply(@Body() body: { eventId: string }) {
    return this.service.applyToParticipants(body?.eventId);
  }
}
