import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { AthletesService } from './athletes.service';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { RequestAthleteAccessDto } from './dto/request-athlete-access.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { UploadHealthDocumentDto } from './dto/upload-health-document.dto';

@Controller('athletes')
export class AthletesController {
  constructor(private readonly athletesService: AthletesService) {}

  @Post()
  create(@Body() createAthleteDto: CreateAthleteDto) {
    return this.athletesService.create(createAthleteDto);
  }

  @Post('request-access')
  requestAccess(@Body() requestAthleteAccessDto: RequestAthleteAccessDto) {
    return this.athletesService.requestAccess(requestAthleteAccessDto.email);
  }

  @Get()
  findAll() {
    return this.athletesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.athletesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAthleteDto: UpdateAthleteDto) {
    return this.athletesService.update(id, updateAthleteDto);
  }

  @Post(':id/health-document')
  uploadHealthDocument(
    @Param('id') id: string,
    @Body() payload: UploadHealthDocumentDto,
  ) {
    return this.athletesService.uploadHealthDocument(id, payload.dataUrl);
  }

  /**
   * URL firmada de vigencia limitada para el documento médico (SA-BACKEND-01
   * Req 1): sólo el titular con sesión de portal o el personal del panel.
   */
  @Get(':id/health-document-url')
  getHealthDocumentUrl(
    @Param('id') id: string,
    @Req() req: { headers: Record<string, string | string[] | undefined> },
  ) {
    return this.athletesService.getHealthDocumentUrl(id, req.headers);
  }

  @Post(':id/photo')
  uploadPhoto(
    @Param('id') id: string,
    @Body() payload: { dataUrl: string },
  ) {
    return this.athletesService.uploadPhoto(id, payload.dataUrl);
  }

  /** Reactiva una cuenta dada de baja desde el portal (status DELETED). */
  @Post(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.athletesService.reactivate(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.athletesService.remove(id);
  }
}
