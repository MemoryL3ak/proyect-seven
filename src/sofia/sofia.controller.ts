import { Body, Controller, Logger, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AskSofiaDto } from './dto/ask-sofia.dto';
import { SofiaService } from './sofia.service';

@Controller('sofia')
export class SofiaController {
  private readonly logger = new Logger(SofiaController.name);

  constructor(private readonly sofiaService: SofiaService) {}

  /** Classic non-streaming endpoint (backward-compatible). */
  @Post('ask')
  async ask(@Body() dto: AskSofiaDto) {
    return this.sofiaService.ask(dto.question, dto.previousResponseId);
  }

  /** SSE streaming endpoint — sends text deltas as they arrive from the LLM. */
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
      );

      const subscription = subject.subscribe({
        next: (chunk) => {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        },
        error: (err) => {
          this.logger.error(`Stream subscription error: ${err}`);
          res.write(
            `data: ${JSON.stringify({ type: 'error', content: String(err) })}\n\n`,
          );
          res.end();
        },
        complete: () => {
          res.end();
        },
      });

      res.on('close', () => {
        subscription.unsubscribe();
      });
    } catch (err) {
      this.logger.error(`Stream setup error: ${err}`);
      res.write(
        `data: ${JSON.stringify({ type: 'error', content: String(err) })}\n\n`,
      );
      res.end();
    }
  }
}
