import { BadRequestException, Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { StaffOnly } from '../auth/staff-only.decorator';
import { GpsTrackersService } from './gps-trackers.service';

/** Equipos GPS de vehículo: estado, paquetes recibidos y asignación a un vehículo. Sólo panel. */
@StaffOnly()
@Controller('gps-trackers')
export class GpsTrackersController {
  constructor(private readonly service: GpsTrackersService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  /** Últimas tramas recibidas (hex), para reconocer un equipo nuevo o depurar. */
  @Get('paquetes')
  paquetes(@Query('imei') imei?: string, @Query('limite') limite?: string) {
    const n = Math.min(Math.max(Number(limite) || 100, 1), 300);
    return this.service.ultimosPaquetes(imei?.trim() || undefined, n);
  }

  @Put(':imei')
  async asignar(@Param('imei') imei: string, @Body() body: { vehicleId?: string | null; label?: string | null }) {
    const limpio = String(imei ?? '').trim();
    if (!/^\d{14,16}$/.test(limpio)) throw new BadRequestException('IMEI inválido');
    const vehicleId = body?.vehicleId ? String(body.vehicleId) : null;
    try {
      return await this.service.asignar(limpio, vehicleId, body?.label);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'No se pudo asignar');
    }
  }
}
