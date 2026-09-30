import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, Req } from '@nestjs/common';
import type { ApiRequest } from '../auth/api-auth.guard';
import { ocultaCobros, puedeVerEvento } from '../auth/permisos-panel';
import { CreateEventDto } from './dto/create-event.dto';
import { GuardarCobrosTransporteDto } from './dto/cobros-transporte.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(createEventDto);
  }

  /**
   * Un usuario del panel acotado a eventos (user_metadata.eventIds) recibe
   * sólo ésos: el selector de evento y los formularios no le ofrecen otros
   * (28-09-2026, usuarios de World Rugby U20).
   */
  @Get()
  async findAll(@Req() req: ApiRequest) {
    const eventos = await this.eventsService.findAll();
    const caller = req.apiCaller;
    if (caller?.type !== 'staff' || !caller.permisos) return eventos;
    const permisos = caller.permisos;
    return (eventos as Array<{ id: string }>).filter((e) => puedeVerEvento(permisos, e.id));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventsService.update(id, updateEventDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }

  /* ─── Cobros de licitación de transporte (dashboard comercial) ─── */

  /** Los valores (clientPrice) los quita el interceptor a quien no tiene Finanzas. */
  @Get(':id/cobros-transporte')
  cobrosTransporte(@Param('id') id: string) {
    return this.eventsService.getCobrosTransporte(id);
  }

  /** Editarlos es de Finanzas: sin el módulo, 403. */
  @Put(':id/cobros-transporte')
  guardarCobrosTransporte(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Body() dto: GuardarCobrosTransporteDto,
  ) {
    if (ocultaCobros(req.apiCaller)) {
      throw new ForbiddenException('Los cobros de licitación requieren el módulo Finanzas');
    }
    return this.eventsService.setCobrosTransporte(id, dto?.cobros);
  }
}
