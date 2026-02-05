import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateHotelBedDto } from './dto/create-hotel-bed.dto';
import { UpdateHotelBedDto } from './dto/update-hotel-bed.dto';
import { HotelBedsService } from './hotel-beds.service';

@Controller('hotel-beds')
export class HotelBedsController {
  constructor(private readonly hotelBedsService: HotelBedsService) {}

  @Post()
  create(@Body() dto: CreateHotelBedDto) {
    return this.hotelBedsService.create(dto);
  }

  @Get()
  findAll() {
    return this.hotelBedsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hotelBedsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHotelBedDto) {
    return this.hotelBedsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.hotelBedsService.remove(id);
  }
}
