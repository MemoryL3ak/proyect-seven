import { StaffOnly } from '../auth/staff-only.decorator';
import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AskSofiaDto } from './dto/ask-sofia.dto';
import { SofiaService } from './sofia.service';

@StaffOnly()
@Controller('sofia')
export class SofiaController {
  private readonly logger = new Logger(SofiaController.name);

  constructor(private readonly sofiaService: SofiaService) {}

  /** Classic non-streaming endpoint (backward-compatible). */
  @Post('ask')
  async ask(@Body() dto: AskSofiaDto) {
    try {
      return await this.sofiaService.ask(dto.question, dto.previousResponseId, dto.locale);
    } catch (err) {
      // El detalle (modelo inválido, clave vencida, timeout del proveedor…)
      // queda en el log del servidor; al cliente le llega un 503 accionable
      // en vez del 500 "Internal server error" que ocultaba la causa.
      this.logger.error(`ask() failed: ${err instanceof Error ? err.message : err}`);
      throw new ServiceUnavailableException(
        'SofIA no está disponible en este momento. Intenta de nuevo en unos minutos.',
      );
    }
  }

  /** SSE streaming endpoint — sends text deltas + render artifacts as they arrive. */
  @Post('ask-stream')
  stream(@Body() dto: AskSofiaDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const subject = this.sofiaService.askStream(
        dto.question,
        dto.previousResponseId,
        dto.locale,
      );
      const subscription = subject.subscribe({
        next: (chunk) => res.write(`data: ${JSON.stringify(chunk)}\n\n`),
        error: (err) => {
          this.logger.error(`Stream subscription error: ${err}`);
          res.write(`data: ${JSON.stringify({ type: 'error', content: String(err) })}\n\n`);
          res.end();
        },
        complete: () => res.end(),
      });
      res.on('close', () => subscription.unsubscribe());
    } catch (err) {
      this.logger.error(`Stream setup error: ${err}`);
      res.write(`data: ${JSON.stringify({ type: 'error', content: String(err) })}\n\n`);
      res.end();
    }
  }

  /**
   * SSE live feed — emits a snapshot every 5s for the requested feed.
   * feed = gps | trips | alerts
   */
  @Get('live')
  live(
    @Query('feed') feed: string,
    @Query('eventId') eventId: string | undefined,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const safeFeed = ['gps', 'trips', 'alerts'].includes(feed) ? feed : 'alerts';
    const subject = this.sofiaService.liveStream(safeFeed, eventId || null);

    const subscription = subject.subscribe({
      next: (snapshot) => res.write(`data: ${JSON.stringify(snapshot)}\n\n`),
      error: (err) => {
        this.logger.error(`Live feed error: ${err}`);
        res.end();
      },
      complete: () => res.end(),
    });

    res.on('close', () => {
      subscription.unsubscribe();
      subject.complete();
    });
  }

  /** Audit log of every action SofIA has executed. */
  @Get('action-log')
  actionLog(@Query('limit') limit?: string) {
    return this.sofiaService.getActionLog(limit ? Number(limit) : 50);
  }
}
