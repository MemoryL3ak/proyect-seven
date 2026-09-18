import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { ApiRequest } from '../auth/api-auth.guard';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { BulkFromScheduleDto } from './dto/bulk-from-schedule.dto';
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

  @Post()
  create(@Body() createTripDto: CreateTripDto) {
    return this.tripsService.create(createTripDto);
  }

  @Get()
  async findAll(
    @Req() req: ApiRequest,
    @Query('requesterAthleteId') requesterAthleteId?: string,
  ) {
    // Jefe de Misión: sólo los viajes de su delegación.
    const scope = await this.scope.forRequest(req);
    const delegationId = scope?.kind === 'mission_head' ? scope.delegationId : null;
    return this.tripsService.findAll(requesterAthleteId, delegationId);
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
