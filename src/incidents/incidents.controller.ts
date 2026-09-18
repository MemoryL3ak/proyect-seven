import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { ApiRequest } from '../auth/api-auth.guard';
import { Protected } from '../auth/public.decorator';
import { StaffScopeService } from '../auth/staff-scope.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentsService } from './incidents.service';

/**
 * Incidencias: las ven y reportan operaciones (panel) y los Jefes de Misión
 * (participantes que entran por el portal). StaffScopeService.requireOperator
 * rechaza a cualquier otra sesión de portal y acota al jefe a su delegación.
 */
@Protected()
@Controller('incidents')
export class IncidentsController {
  constructor(
    private readonly service: IncidentsService,
    private readonly scope: StaffScopeService,
  ) {}

  @Get()
  async list(
    @Req() req: ApiRequest,
    @Query('eventId') eventId?: string,
    @Query('delegationId') delegationId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list({ eventId, delegationId, status }, await this.scope.requireOperator(req));
  }

  @Get(':id')
  async findOne(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.service.findOne(id, await this.scope.requireOperator(req));
  }

  @Post()
  async create(@Req() req: ApiRequest, @Body() dto: CreateIncidentDto) {
    return this.service.create(dto, await this.scope.requireOperator(req));
  }

  @Patch(':id')
  async update(@Req() req: ApiRequest, @Param('id') id: string, @Body() dto: UpdateIncidentDto) {
    return this.service.update(id, dto, await this.scope.requireOperator(req));
  }

  @Delete(':id')
  async remove(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.service.remove(id, await this.scope.requireOperator(req));
  }
}
