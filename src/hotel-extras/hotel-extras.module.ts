import { Module } from '@nestjs/common';
import { HotelExtrasController } from './hotel-extras.controller';
import { HotelExtrasService } from './hotel-extras.service';

@Module({
  controllers: [HotelExtrasController],
  providers: [HotelExtrasService],
})
export class HotelExtrasModule {}
