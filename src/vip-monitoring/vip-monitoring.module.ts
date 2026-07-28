import { Module } from '@nestjs/common';
import { VipMonitoringController } from './vip-monitoring.controller';
import { VipMonitoringService } from './vip-monitoring.service';

@Module({
  controllers: [VipMonitoringController],
  providers: [VipMonitoringService],
})
export class VipMonitoringModule {}
