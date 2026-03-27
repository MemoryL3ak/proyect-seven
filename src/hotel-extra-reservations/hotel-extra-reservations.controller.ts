import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateHotelExtraReservationDto } from './dto/create-hotel-extra-reservation.dto';
import { UpdateHotelExtraReservationDto } from './dto/update-hotel-extra-reservation.dto';
import { HotelExtraReservationsService } from './hotel-extra-reservations.service';

@Controller('hotel-extra-reservations')
export class HotelExtraReservationsController {
  constructor(private readonly service: HotelExtraReservationsService) {}

  @Post()
  create(@Body() dto: CreateHotelExtraReservationDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHotelExtraReservationDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
