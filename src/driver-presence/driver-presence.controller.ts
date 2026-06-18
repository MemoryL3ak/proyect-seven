import { Body, Controller, Get, Logger, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DriverPresenceService } from './driver-presence.service';
import { HeartbeatDto } from './dto/heartbeat.dto';

@Controller('driver-presence')
export class DriverPresenceController {
  private readonly logger = new Logger(DriverPresenceController.name);

  constructor(private readonly service: DriverPresenceService) {}

  /** Latido enviado por el Portal Conductor mientras la app está abierta. */
  @Post('heartbeat')
  heartbeat(@Body() dto: HeartbeatDto) {
    return this.service.heartbeat(dto);
  }

  /** Lista de conductores con su estado de presencia. */
  @Get()
  list(@Query('eventId') eventId?: string, @Query('date') date?: string) {
    return this.service.list(eventId, date);
  }

  /** KPIs agregados de presencia. */
  @Get('stats')
  stats(@Query('eventId') eventId?: string) {
    return this.service.stats(eventId);
  }

  /** Snapshot puntual (lista + stats). */
  @Get('snapshot')
  snapshot(@Query('eventId') eventId?: string, @Query('date') date?: string) {
    return this.service.snapshot(eventId, date);
  }

  /** SSE: emite un snapshot de presencia cada 8 segundos. */
  @Get('live')
  live(
    @Query('eventId') eventId: string | undefined,
    @Query('date') date: string | undefined,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const subject = this.service.liveStream(eventId, date);
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
