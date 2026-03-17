import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto';
import { AccommodationsService } from './accommodations.service';

@Controller('accommodations')
export class AccommodationsController {
  constructor(private readonly accommodationsService: AccommodationsService) {}

  @Post()
  create(@Body() createAccommodationDto: CreateAccommodationDto) {
    return this.accommodationsService.create(createAccommodationDto);
  }

  @Get()
  findAll() {
    return this.accommodationsService.findAll();
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
