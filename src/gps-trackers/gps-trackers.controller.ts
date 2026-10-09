import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { StaffOnly } from '../auth/staff-only.decorator';
import { GpsTrackersService } from './gps-trackers.service';

/** Equipos GPS de vehículo: estado, paquetes recibidos y asignación a una patente. Sólo panel. */
@StaffOnly()
@Controller('gps-trackers')
export class GpsTrackersController {
  constructor(private readonly service: GpsTrackersService) {}

  @Get()
  listar(@Query('eventId') eventId?: string) {
    return this.service.listar(eventId?.trim() || undefined);
  }

  /** Patentes conocidas del evento, para el selector de asignación. */
  @Get('patentes')
  patentes(@Query('eventId') eventId?: string) {
    return this.service.patentes(eventId?.trim() || undefined);
  }

  /** Últimas tramas recibidas (hex), para reconocer un equipo nuevo o depurar. */
  @Get('paquetes')
  paquetes(@Query('imei') imei?: string, @Query('limite') limite?: string) {
    const n = Math.min(Math.max(Number(limite) || 100, 1), 300);
    return this.service.ultimosPaquetes(imei?.trim() || undefined, n);
  }

  /** Comando en línea al equipo (texto de los comandos SMS, termina en #). La respuesta queda en /paquetes. */
  @Post(':imei/comando')
  comando(@Param('imei') imei: string, @Body() body: { texto?: string }) {
    const limpio = String(imei ?? '').trim();
    if (!/^\d{14,16}$/.test(limpio)) throw new BadRequestException('IMEI inválido');
    const texto = String(body?.texto ?? '').trim();
    if (!/^[\x20-\x7e]{2,100}#$/.test(texto)) throw new BadRequestException('El comando va en ASCII y termina en #');
    return this.service.enviarComando(limpio, texto);
  }

  @Put(':imei')
  async asignar(@Param('imei') imei: string, @Body() body: { plate?: string | null; label?: string | null }) {
    const limpio = String(imei ?? '').trim();
    if (!/^\d{14,16}$/.test(limpio)) throw new BadRequestException('IMEI inválido');
    const plate = body?.plate ? String(body.plate) : null;
    try {
      return await this.service.asignar(limpio, plate, body?.label);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'No se pudo asignar');
    }
  }
}
