import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateProviderDto } from './dto/create-provider.dto';
import { CreateProviderRateDto } from './dto/create-provider-rate.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { UploadProviderDocumentDto } from './dto/upload-provider-document.dto';
import { ProvidersService } from './providers.service';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  create(@Body() createProviderDto: CreateProviderDto) {
    return this.providersService.create(createProviderDto);
  }

  @Get()
  findAll() {
    return this.providersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.providersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProviderDto: UpdateProviderDto) {
    return this.providersService.update(id, updateProviderDto);
  }

  @Post(':id/document')
  uploadDocument(
    @Param('id') id: string,
    @Body() payload: UploadProviderDocumentDto,
  ) {
    return this.providersService.uploadDocument(id, payload.key, payload.dataUrl);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.providersService.remove(id);
  }

  /* ─── Provider Rates ─── */

  @Get(':id/rates')
  findRates(@Param('id') id: string) {
    return this.providersService.findRates(id);
  }

  @Post(':id/rates')
  createRate(@Param('id') id: string, @Body() dto: CreateProviderRateDto) {
    return this.providersService.createRate({ ...dto, providerId: id });
  }

  @Post(':id/rates/bulk')
  bulkUpsertRates(@Param('id') id: string, @Body() rates: CreateProviderRateDto[]) {
    return this.providersService.bulkUpsertRates(id, rates);
  }

  @Delete(':id/rates/:rateId')
  removeRate(@Param('id') id: string, @Param('rateId') rateId: string) {
    return this.providersService.removeRate(id, rateId);
  }
}
