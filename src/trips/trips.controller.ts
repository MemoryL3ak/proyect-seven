import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { ApiRequest } from '../auth/api-auth.guard';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { BulkFromScheduleDto } from './dto/bulk-from-schedule.dto';
import { BulkDeleteTripsDto } from './dto/bulk-delete-trips.dto';
import { AutoAssignDriversDto } from './dto/auto-assign-drivers.dto';
import { TripsService } from './trips.service';
import { TripsScheduleService } from './trips-schedule.service';
import { TripsFinanceService } from './trips-finance.service';
import { StaffScopeService } from '../auth/staff-scope.service';

@Controller('trips')
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly scheduleService: TripsScheduleService,
    private readonly financeService: TripsFinanceService,
    private readonly scope: StaffScopeService,
  ) {}

  /* ─── Operatividad diaria ─── */

  @Post('bulk-from-schedule')
  bulkFromSchedule(@Body() dto: BulkFromScheduleDto) {
    return this.scheduleService.bulkFromSchedule(dto);
  }

  @Post('auto-assign-drivers')
  autoAssignDrivers(@Body() dto: AutoAssignDriversDto) {
    return this.scheduleService.autoAssignDrivers(dto);
  }

  // Borrado en lote desde la lista de viajes. Va como POST y no como
  // DELETE ':id' para que "bulk-delete" no se confunda nunca con un id.
  @Post('bulk-delete')
  bulkDelete(@Body() dto: BulkDeleteTripsDto) {
    return this.tripsService.removeMany(dto.ids);
  }

  @Post()
  create(@Body() createTripDto: CreateTripDto) {
    return this.tripsService.create(createTripDto);
  }

  @Get()
  async findAll(
    @Req() req: ApiRequest,
    @Query('requesterAthleteId') requesterAthleteId?: string,
  ) {
    const scope = await this.scope.forRequest(req);
    // Jefe de Misión: sólo los viajes de su delegación.
    const delegationId = scope?.kind === 'mission_head' ? scope.delegationId : null;
    // Un participante corriente ve los suyos y nada más. Sin esto, pedir
    // /trips a secas devolvía la operación completa del evento a cualquiera
    // con sesión de portal. El Coordinador de Comité sí ve todo: ése es su
    // trabajo, y por eso es un tipo de cliente aparte.
    const soloSuyos = scope?.kind === 'participant' ? scope.userId : requesterAthleteId;
    return this.tripsService.findAll(soloSuyos, delegationId);
  }

  /* ─── Panel financiero ─── */
  // Deben declararse antes de `:id`, o Nest resolvería "finance" como un id.

  @Get('finance/summary')
  financeSummary(
    @Query('eventId') eventId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('clientType') clientType?: string,
    @Query('fleet') fleet?: string,
    @Query('service') service?: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.financeService.summary({ eventId, from, to, clientType, fleet, service, providerId });
  }

  @Get('finance/detail')
  financeDetail(
    @Query('eventId') eventId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('clientType') clientType?: string,
    @Query('fleet') fleet?: string,
    @Query('service') service?: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.financeService.detail({ eventId, from, to, clientType, fleet, service, providerId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tripsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTripDto: UpdateTripDto,
    @Req() req: ApiRequest,
  ) {
    // El guard global deja en req.apiCaller quien hace el cambio; la bitacora
    // lo necesita para firmar las entradas con un nombre y no con "Sistema".
    return this.tripsService.update(id, updateTripDto, req.apiCaller);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tripsService.remove(id);
  }

  /* ─── Passenger position ─── */

  @Patch(':id/passenger-position')
  updatePassengerPosition(
    @Param('id') id: string,
    @Body() body: { lat: number; lng: number },
  ) {
    return this.tripsService.updatePassengerPosition(id, body.lat, body.lng);
  }

  /* ─── Trip Chat ─── */

  @Get(':id/messages')
  getMessages(
    @Param('id') id: string,
    @Query('since') since?: string,
  ) {
    return this.tripsService.getMessages(id, since);
  }

  @Post(':id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() body: { senderType: 'DRIVER' | 'PASSENGER'; senderName: string; content: string },
  ) {
    return this.tripsService.sendMessage(id, body.senderType, body.senderName, body.content);
  }
}
