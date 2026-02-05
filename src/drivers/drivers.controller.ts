import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateDriverDto } from './dto/create-driver.dto';
import { RequestDriverAccessDto } from './dto/request-driver-access.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UploadDriverPhotoDto } from './dto/upload-driver-photo.dto';
import { DriversService } from './drivers.service';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  create(@Body() createDriverDto: CreateDriverDto) {
    return this.driversService.create(createDriverDto);
  }

  @Post('request-access')
  requestAccess(@Body() payload: RequestDriverAccessDto) {
    return this.driversService.requestAccess(payload.email);
  }

  @Get()
  findAll() {
    return this.driversService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.driversService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDriverDto: UpdateDriverDto) {
    return this.driversService.update(id, updateDriverDto);
  }

  @Post(':id/photo')
  uploadPhoto(
    @Param('id') id: string,
    @Body() payload: UploadDriverPhotoDto,
  ) {
    return this.driversService.uploadPhoto(id, payload.dataUrl);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.driversService.remove(id);
  }
}
