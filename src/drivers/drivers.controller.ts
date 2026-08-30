import { isSelfCaller, isStaffCaller } from '../auth/api-auth.guard';
import type { ApiRequest } from '../auth/api-auth.guard';
import { Public } from '../auth/public.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
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

  /** Recuperación del código de acceso por correo — público. */
  @Public()
  @Post('request-access')
  requestAccess(@Body() payload: RequestDriverAccessDto) {
    return this.driversService.requestAccess(payload.email);
  }

  /** SA-BACKEND-03 · 5.3.2: credentialCode fuera de los listados; en el detalle sólo staff o el propio conductor. */
  @Get()
  async findAll() {
    const drivers = await this.driversService.findAll();
    return drivers.map(({ credentialCode: _omit, ...rest }) => rest);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: ApiRequest) {
    const driver = await this.driversService.findOne(id);
    if (isStaffCaller(req.apiCaller) || isSelfCaller(req.apiCaller, id)) {
      return driver;
    }
    const { credentialCode: _omit, ...rest } = driver;
    return rest;
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

  @Post(':id/document')
  uploadDocument(
    @Param('id') id: string,
    @Body() payload: { key: string; dataUrl: string },
  ) {
    return this.driversService.uploadDocument(id, payload.key, payload.dataUrl);
  }

  @Post(':id/journey-photo')
  uploadJourneyPhoto(
    @Param('id') id: string,
    @Body() payload: { kind: 'START' | 'END'; date: string; dataUrl: string; tripId?: string },
  ) {
    return this.driversService.uploadJourneyPhoto(
      id,
      payload.kind,
      payload.date,
      payload.dataUrl,
      payload.tripId,
    );
  }

  /** Reactiva una cuenta dada de baja desde el portal (status DELETED). */
  @Post(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.driversService.reactivate(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.driversService.remove(id);
  }
}
