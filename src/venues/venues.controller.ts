import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { UploadVenuePhotoDto } from './dto/upload-venue-photo.dto';
import { VenuesService } from './venues.service';

@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  create(@Body() createVenueDto: CreateVenueDto) {
    return this.venuesService.create(createVenueDto);
  }

  @Get()
  findAll() {
    return this.venuesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.venuesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVenueDto: UpdateVenueDto) {
    return this.venuesService.update(id, updateVenueDto);
  }

  @Post(':id/photo')
  uploadPhoto(@Param('id') id: string, @Body() payload: UploadVenuePhotoDto) {
    return this.venuesService.uploadPhoto(id, payload.dataUrl);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.venuesService.remove(id);
  }
}
