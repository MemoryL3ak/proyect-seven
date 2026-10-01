import { Protected } from '../auth/public.decorator';
import { StaffOnly } from '../auth/staff-only.decorator';
import type { ApiRequest } from '../auth/api-auth.guard';
import { ocultaCobros } from '../auth/permisos-panel';
import { StaffScopeService, type SofiaCallerScope } from '../auth/staff-scope.service';
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
import { Req } from '@nestjs/common';
import type { Response } from 'express';
import { AskSofiaDto } from './dto/ask-sofia.dto';
import { EventoContexto, eventoDeConsulta } from './evento-de-consulta';
import { SofiaService } from './sofia.service';

@Protected()
@Controller('sofia')
export class SofiaController {
  private readonly logger = new Logger(SofiaController.name);

  constructor(
    private readonly sofiaService: SofiaService,
    private readonly scope: StaffScopeService,
  ) {}

  /**
   * Alcance del llamador: null para el panel (agente completo) y la delegación
   * para un Jefe de Misión (sólo consulta, sólo su región). Cualquier otra
   * sesión de portal recibe 403.
   */
  private async scopeOf(req: ApiRequest): Promise<SofiaCallerScope> {
    const caller = await this.scope.requireOperator(req);
    return caller.kind === 'mission_head' && caller.delegationId
      ? { delegationId: caller.delegationId, delegationName: caller.delegationName }
      : null;
  }

  /**
   * Evento al que se refiere la consulta: el que el panel tiene en pantalla
   * si el usuario puede verlo; para una cuenta acotada a un evento, ése
   * (01-10-2026: las coordinadoras de World Rugby recibían datos de los
   * Juegos Escolares, el evento ACTIVE más reciente).
   */
  private contextoDe(req: ApiRequest, dto: AskSofiaDto): EventoContexto {
    const caller = req.apiCaller as { type?: string; permisos?: { eventIds?: string[] | null } | null } | undefined;
    const propios = caller?.type === 'staff' ? caller.permisos?.eventIds ?? null : null;
    const permitidos = propios && propios.length > 0 ? propios : null;
    return { actual: eventoDeConsulta(dto.eventId, permitidos), permitidos };
  }

  /** Classic non-streaming endpoint (backward-compatible). */
  @Post('ask')
  async ask(@Body() dto: AskSofiaDto, @Req() req: ApiRequest) {
    const scope = await this.scopeOf(req);
    const contexto = this.contextoDe(req, dto);
    try {
      return await this.sofiaService.ask(dto.question, dto.previousResponseId, dto.locale, scope, ocultaCobros(req.apiCaller), contexto);
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
  async stream(@Body() dto: AskSofiaDto, @Res() res: Response, @Req() req: ApiRequest) {
    const scope = await this.scopeOf(req);
    const contexto = this.contextoDe(req, dto);
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
        scope,
        ocultaCobros(req.apiCaller),
        contexto,
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
  // Feeds globales (GPS, viajes, alertas) y auditoría: sólo el panel.
  @StaffOnly()
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
  @StaffOnly()
  @Get('action-log')
  actionLog(@Query('limit') limit?: string) {
    return this.sofiaService.getActionLog(limit ? Number(limit) : 50);
  }
}
