import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateHotelRoomDto } from './dto/create-hotel-room.dto';
import { UpdateHotelRoomDto } from './dto/update-hotel-room.dto';
import { HotelRoomsService } from './hotel-rooms.service';

@Controller('hotel-rooms')
export class HotelRoomsController {
  constructor(private readonly hotelRoomsService: HotelRoomsService) {}

  @Post()
  create(@Body() dto: CreateHotelRoomDto) {
    return this.hotelRoomsService.create(dto);
  }

  @Get()
  findAll() {
    return this.hotelRoomsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hotelRoomsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHotelRoomDto) {
    return this.hotelRoomsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.hotelRoomsService.remove(id);
  }
}
