import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { ApiRequest } from '../auth/api-auth.guard';
import { StaffOnly } from '../auth/staff-only.decorator';
import { StaffScopeService } from '../auth/staff-scope.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentsService } from './incidents.service';

/**
 * Incidencias: las reportan y ven usuarios del panel (operaciones y jefes de
 * misión). El alcance por delegación se resuelve con StaffScopeService.
 */
@StaffOnly()
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
    return this.service.list({ eventId, delegationId, status }, await this.scope.forRequest(req));
  }

  @Get(':id')
  async findOne(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.service.findOne(id, await this.scope.forRequest(req));
  }

  @Post()
  async create(@Req() req: ApiRequest, @Body() dto: CreateIncidentDto) {
    return this.service.create(dto, await this.scope.forRequest(req));
  }

  @Patch(':id')
  async update(@Req() req: ApiRequest, @Param('id') id: string, @Body() dto: UpdateIncidentDto) {
    return this.service.update(id, dto, await this.scope.forRequest(req));
  }

  @Delete(':id')
  async remove(@Req() req: ApiRequest, @Param('id') id: string) {
    return this.service.remove(id, await this.scope.forRequest(req));
  }
}
