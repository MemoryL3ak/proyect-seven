import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateHotelKeyDto } from './dto/create-hotel-key.dto';
import { IssueHotelKeyDto } from './dto/issue-hotel-key.dto';
import { ReturnHotelKeyDto } from './dto/return-hotel-key.dto';
import { UpdateHotelKeyDto } from './dto/update-hotel-key.dto';
import { UpdateHotelKeyStatusDto } from './dto/update-hotel-key-status.dto';
import { HotelKeysService } from './hotel-keys.service';

@Controller('hotel-keys')
export class HotelKeysController {
  constructor(private readonly hotelKeysService: HotelKeysService) {}

  @Post()
  create(@Body() dto: CreateHotelKeyDto) {
    return this.hotelKeysService.create(dto);
  }

  @Get()
  findAll() {
    return this.hotelKeysService.findAll();
  }

  @Get('movements')
  findAllMovements() {
    return this.hotelKeysService.findMovements();
  }

  @Get(':id/movements')
  findMovementsByKey(@Param('id') id: string) {
    return this.hotelKeysService.findMovements(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hotelKeysService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHotelKeyDto) {
    return this.hotelKeysService.update(id, dto);
  }

  @Post(':id/issue')
  issue(@Param('id') id: string, @Body() dto: IssueHotelKeyDto) {
    return this.hotelKeysService.issue(id, dto);
  }

  @Post(':id/return')
  returnKey(@Param('id') id: string, @Body() dto: ReturnHotelKeyDto) {
    return this.hotelKeysService.returnKey(id, dto);
  }

  @Post(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateHotelKeyStatusDto) {
    return this.hotelKeysService.updateStatus(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.hotelKeysService.remove(id);
  }
}
