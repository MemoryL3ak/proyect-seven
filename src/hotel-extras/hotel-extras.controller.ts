import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateHotelExtraDto } from './dto/create-hotel-extra.dto';
import { UpdateHotelExtraDto } from './dto/update-hotel-extra.dto';
import { HotelExtrasService } from './hotel-extras.service';

@Controller('hotel-extras')
export class HotelExtrasController {
  constructor(private readonly hotelExtrasService: HotelExtrasService) {}

  @Post()
  create(@Body() dto: CreateHotelExtraDto) {
    return this.hotelExtrasService.create(dto);
  }

  @Get()
  findAll() {
    return this.hotelExtrasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hotelExtrasService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHotelExtraDto) {
    return this.hotelExtrasService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.hotelExtrasService.remove(id);
  }
}
