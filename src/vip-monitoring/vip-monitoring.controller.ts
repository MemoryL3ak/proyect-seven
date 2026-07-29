import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { VipMonitoringService } from './vip-monitoring.service';

@Controller('vip-monitoring')
export class VipMonitoringController {
  constructor(private readonly service: VipMonitoringService) {}

  @Get('snapshot')
  snapshot(@Query('eventId') eventId?: string) {
    return this.service.snapshot(eventId);
  }

  /** El portal del usuario reporta aquí su ubicación periódicamente. */
  @Post('position')
  reportPosition(
    @Body()
    body: { athleteId?: string; lat?: number; lng?: number; accuracy?: number },
  ) {
    return this.service.reportPosition(body ?? {});
  }
}
