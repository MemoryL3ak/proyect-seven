import { Module } from '@nestjs/common';
import { DelegationHotelsController } from './delegation-hotels.controller';
import { DelegationHotelsService } from './delegation-hotels.service';

@Module({
  controllers: [DelegationHotelsController],
  providers: [DelegationHotelsService],
})
export class DelegationHotelsModule {}
