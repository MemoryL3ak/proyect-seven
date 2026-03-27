import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateProviderDto } from './dto/create-provider.dto';
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
}
