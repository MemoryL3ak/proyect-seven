import { Body, Controller, Get, Logger, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiRequest } from '../auth/api-auth.guard';
import { StaffScopeService } from '../auth/staff-scope.service';
import { DriverPresenceService } from './driver-presence.service';
import { HeartbeatDto } from './dto/heartbeat.dto';

/**
 * Presencia de conductores. Los GET los usan el panel y el Jefe de Misión
 * (participante del portal): éste recibe sólo la flota de su región. El
 * alcance se resuelve en el backend, no se confía en filtros del navegador;
 * cualquier otra sesión de portal recibe 403.
 */
@Controller('driver-presence')
export class DriverPresenceController {
  private readonly logger = new Logger(DriverPresenceController.name);

  constructor(
    private readonly service: DriverPresenceService,
    private readonly scope: StaffScopeService,
  ) {}

  /** Latido enviado por el Portal Conductor mientras la app está abierta. */
  @Post('heartbeat')
  heartbeat(@Body() dto: HeartbeatDto) {
    return this.service.heartbeat(dto);
  }

  /** Lista de conductores con su estado de presencia. */
  @Get()
  async list(
    @Req() req: ApiRequest,
    @Query('eventId') eventId?: string,
    @Query('date') date?: string,
  ) {
    return this.service.list(eventId, date, (await this.scope.requireOperator(req)).delegationId);
  }

  /** KPIs agregados de presencia. */
  @Get('stats')
  async stats(@Req() req: ApiRequest, @Query('eventId') eventId?: string) {
    return this.service.stats(eventId, (await this.scope.requireOperator(req)).delegationId);
  }

  /** Snapshot puntual (lista + stats). */
  @Get('snapshot')
  async snapshot(
    @Req() req: ApiRequest,
    @Query('eventId') eventId?: string,
    @Query('date') date?: string,
  ) {
    return this.service.snapshot(eventId, date, (await this.scope.requireOperator(req)).delegationId);
  }

  /** SSE: emite un snapshot de presencia cada 8 segundos. */
  @Get('live')
  async live(
    @Req() req: ApiRequest,
    @Query('eventId') eventId: string | undefined,
    @Query('date') date: string | undefined,
    @Res() res: Response,
  ) {
    const { delegationId } = await this.scope.requireOperator(req);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const subject = this.service.liveStream(eventId, date, delegationId);
    const subscription = subject.subscribe({
      next: (snapshot) => res.write(`data: ${JSON.stringify(snapshot)}\n\n`),
      error: (err) => {
        this.logger.error(`Live presence error: ${err}`);
        res.end();
      },
      complete: () => res.end(),
    });

    res.on('close', () => {
      subscription.unsubscribe();
      subject.complete();
    });
  }
}
