import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto';
import { AccommodationsService } from './accommodations.service';
import type { ApiRequest } from '../auth/api-auth.guard';
import { StaffScopeService } from '../auth/staff-scope.service';

@Controller('accommodations')
export class AccommodationsController {
  constructor(
    private readonly accommodationsService: AccommodationsService,
    private readonly scope: StaffScopeService,
  ) {}

  @Post()
  create(@Body() createAccommodationDto: CreateAccommodationDto) {
    return this.accommodationsService.create(createAccommodationDto);
  }

  @Get()
  async findAll(@Req() req: ApiRequest) {
    // Jefe de Misión: sólo los hoteles de su delegación.
    const scope = await this.scope.forRequest(req);
    const delegationId = scope?.kind === 'mission_head' ? scope.delegationId : null;
    return this.accommodationsService.findAll(delegationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accommodationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAccommodationDto: UpdateAccommodationDto,
  ) {
    return this.accommodationsService.update(id, updateAccommodationDto);
  }

  @Post(':id/photo')
  uploadPhoto(@Param('id') id: string, @Body() body: { dataUrl?: string }) {
    return this.accommodationsService.uploadPhoto(id, body?.dataUrl ?? '');
  }

  @Patch(':id/sync-rooms')
  syncRooms(
    @Param('id') id: string,
    @Body() body: { roomInventory?: Record<string, number> },
  ) {
    return this.accommodationsService.syncRoomsFromInventory(id, body?.roomInventory ?? {});
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.accommodationsService.remove(id);
  }
}
