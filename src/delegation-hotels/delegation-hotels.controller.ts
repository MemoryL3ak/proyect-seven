import { Body, Controller, ForbiddenException, Get, Post, Put, Query, Req } from '@nestjs/common';
import type { ApiRequest } from '../auth/api-auth.guard';
import { StaffOnly } from '../auth/staff-only.decorator';
import { StaffScopeService } from '../auth/staff-scope.service';
import { CeldaHotel, DelegationHotelsService } from './delegation-hotels.service';

/**
 * Planilla de alojamiento por delegación y disciplina.
 *
 * Escribirla es cosa del panel. Leerla la necesita también el Coordinador de
 * Comité desde la app: su módulo de hoteles muestra qué selección duerme en
 * cada hotel, y eso sale de aquí.
 */
@Controller('delegation-hotels')
export class DelegationHotelsController {
  constructor(
    private readonly service: DelegationHotelsService,
    private readonly scope: StaffScopeService,
  ) {}

  @Get()
  async findByEvent(@Req() req: ApiRequest, @Query('eventId') eventId: string) {
    const alcance = await this.scope.forRequest(req);
    if (alcance?.kind !== 'staff' && alcance?.kind !== 'committee') {
      throw new ForbiddenException('Sólo el panel y la coordinación del comité.');
    }
    return this.service.findByEvent(eventId);
  }

  @StaffOnly()
  @Put()
  saveMany(@Body() body: { eventId: string; cells: CeldaHotel[] }) {
    return this.service.saveMany(body?.eventId, body?.cells ?? []);
  }

  /** Cuántos participantes hay en una región + deporte. */
  @StaffOnly()
  @Get('group-count')
  contarGrupo(
    @Query('eventId') eventId: string,
    @Query('delegationId') delegationId: string,
    @Query('disciplineId') disciplineId: string,
  ) {
    return this.service.contarGrupo(eventId, delegationId, disciplineId);
  }

  /** Deja a toda una selección (región + deporte) en un hotel. */
  @StaffOnly()
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
  @StaffOnly()
  @Post('apply')
  apply(@Body() body: { eventId: string }) {
    return this.service.applyToParticipants(body?.eventId);
  }
}
