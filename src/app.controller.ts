import { Public } from './auth/public.decorator';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Health check de la plataforma (Railway) — público. */
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
