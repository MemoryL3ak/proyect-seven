import { isSelfCaller, isStaffCaller } from '../auth/api-auth.guard';
import type { ApiRequest } from '../auth/api-auth.guard';
import { Public } from '../auth/public.decorator';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Query,
} from '@nestjs/common';
import { AthletesService } from './athletes.service';
import { StaffScopeService } from '../auth/staff-scope.service';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { RequestAthleteAccessDto } from './dto/request-athlete-access.dto';
import { SendAccessCodesDto } from './dto/send-access-codes.dto';
import { StaffOnly } from '../auth/staff-only.decorator';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { UploadHealthDocumentDto } from './dto/upload-health-document.dto';

@Controller('athletes')
export class AthletesController {
  constructor(
    private readonly athletesService: AthletesService,
    private readonly scope: StaffScopeService,
  ) {}

  @Post()
  create(@Body() createAthleteDto: CreateAthleteDto) {
    return this.athletesService.create(createAthleteDto);
  }

  /** Recuperación del código de acceso por correo — público. */
  @Public()
  @Post('request-access')
  requestAccess(@Body() requestAthleteAccessDto: RequestAthleteAccessDto) {
    return this.athletesService.requestAccess(requestAthleteAccessDto.email);
  }

  /**
   * Envío del código de acceso desde el panel, a uno o a varios.
   *
   * Sólo el panel: el de arriba es la recuperación que pide el propio
   * participante con su correo, y acá se manda por id a quien sea. Con esta
   * ruta abierta, cualquiera podría disparar correos a toda la nómina.
   */
  @StaffOnly()
  @Post('access-codes')
  sendAccessCodes(@Body() dto: SendAccessCodesDto) {
    return this.athletesService.sendAccessCodes(dto?.ids ?? []);
  }

  /**
   * SA-BACKEND-03 · 5.3.2: credentialCode (código de la credencial de
   * acreditación) nunca forma parte de un listado. En el detalle sólo lo ve
   * el personal del panel o el propio titular (su credencial digital).
   */
  @Get()
  async findAll(
    @Req() req: ApiRequest,
    @Query('delegationId') delegationId?: string,
    @Query('eventId') eventId?: string,
  ) {
    // Filtros del servidor: el portal del Jefe de Misión traía los ~2.400
    // participantes del evento sólo para quedarse con los de su región.
    //
    // Quien entra por el portal ve su delegación y sólo la suya. El
    // parámetro llega del cliente: quedarse con lo que pida dejaba la nómina
    // completa de cualquier otra región a un cambio de URL de distancia.
    // El personal del panel sí necesita consultarlas todas.
    const alcance = await this.scope.forRequest(req);
    // El Coordinador de Comité queda fuera a propósito: ve la nómina
    // completa del evento, que es lo que coordina.
    const acotado =
      alcance?.kind === 'mission_head' ||
      alcance?.kind === 'participant' ||
      alcance?.kind === 'driver';
    if (acotado && !alcance?.delegationId) return [];
    const athletes = await this.athletesService.findAll({
      delegationId: acotado ? alcance!.delegationId! : delegationId,
      eventId,
    });
    return athletes.map(({ credentialCode: _omit, ...rest }) => rest);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: ApiRequest) {
    const athlete = await this.athletesService.findOne(id);
    if (isStaffCaller(req.apiCaller) || isSelfCaller(req.apiCaller, id)) {
      return athlete;
    }
    const { credentialCode: _omit, ...rest } = athlete;
    return rest;
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

  /**
   * Foto del participante: la carga el panel, o el propio titular desde su
   * portal.
   *
   * El dueño se verifica acá. La ruta estaba protegida —pedía sesión— pero no
   * miraba de quién era la ficha: mientras sólo la usaba el panel daba igual,
   * y al abrirla al portal cualquier participante con sesión podría haberle
   * cambiado la foto de la credencial a cualquier otro.
   */
  @Post(':id/photo')
  uploadPhoto(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Body() payload: { dataUrl: string },
  ) {
    if (!isStaffCaller(req.apiCaller) && !isSelfCaller(req.apiCaller, id)) {
      throw new ForbiddenException('Sólo puedes cambiar tu propia foto');
    }
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
