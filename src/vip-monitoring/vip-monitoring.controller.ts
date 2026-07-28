import { Controller, Get, Query } from '@nestjs/common';
import { VipMonitoringService } from './vip-monitoring.service';

@Controller('vip-monitoring')
export class VipMonitoringController {
  constructor(private readonly service: VipMonitoringService) {}

  @Get('snapshot')
  snapshot(@Query('eventId') eventId?: string) {
    return this.service.snapshot(eventId);
  }
}
