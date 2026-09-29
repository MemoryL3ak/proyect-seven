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
import { StaffOnly } from '../auth/staff-only.decorator';
import { CambiarEventoDto } from './dto/cambiar-evento.dto';
import { CreateProviderParticipantDto } from './dto/create-provider-participant.dto';
import { UpdateProviderParticipantDto } from './dto/update-provider-participant.dto';
import { ProviderParticipantsService } from './provider-participants.service';
import type { ParteDeDocumento } from '../shared/subida-por-partes';

@Controller('provider-participants')
export class ProviderParticipantsController {
  constructor(private readonly service: ProviderParticipantsService) {}

  @Post()
  create(@Body() dto: CreateProviderParticipantDto) {
    return this.service.create(dto);
  }

  /**
   * Quita personas del evento activo sin borrarlas: siguen en los otros
   * eventos de su proveedor, con sus viajes (28-09-2026).
   */
  @StaffOnly()
  @Post('quitar-del-evento')
  quitarDelEvento(@Body() dto: CambiarEventoDto) {
    return this.service.cambiarEvento(dto, 'QUITAR');
  }

  /** Devuelve al evento a personas quitadas antes. */
  @StaffOnly()
  @Post('devolver-al-evento')
  devolverAlEvento(@Body() dto: CambiarEventoDto) {
    return this.service.cambiarEvento(dto, 'DEVOLVER');
  }

  @Get()
  findAll(@Query('providerId') providerId?: string) {
    return this.service.findAll(providerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProviderParticipantDto) {
    return this.service.update(id, dto);
  }

  /** Reenvía el correo de bienvenida con el código de acceso (acción del panel). */
  @StaffOnly()
  @Post(':id/send-welcome-email')
  sendWelcomeEmail(@Param('id') id: string) {
    return this.service.sendWelcome(id);
  }

  /** Reactiva una cuenta dada de baja desde el portal (status DELETED). */
  @Post(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.service.reactivate(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/document')
  uploadDocument(
    @Param('id') id: string,
    @Body() body: { key: string; dataUrl: string },
  ) {
    return this.service.uploadDocument(id, body.key, body.dataUrl);
  }

  /** Documento en pedazos: la app reintenta sólo el que se cortó. */
  @Post(':id/document-part')
  uploadDocumentPart(@Param('id') id: string, @Body() body: Partial<ParteDeDocumento>) {
    return this.service.uploadDocumentPart(id, body);
  }
}
