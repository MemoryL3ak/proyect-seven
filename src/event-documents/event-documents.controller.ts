import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateEventDocumentDto } from './dto/create-event-document.dto';
import { UpdateEventDocumentDto } from './dto/update-event-document.dto';
import { EventDocumentsService } from './event-documents.service';

@Controller('event-documents')
export class EventDocumentsController {
  constructor(private readonly service: EventDocumentsService) {}

  @Post()
  create(@Body() dto: CreateEventDocumentDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('eventId') eventId?: string,
    @Query('audience') audience?: string,
  ) {
    return this.service.findAll({ eventId, audience });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDocumentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
