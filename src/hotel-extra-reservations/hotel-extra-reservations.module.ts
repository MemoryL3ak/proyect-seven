import { Module } from '@nestjs/common';
import { HotelExtraReservationsController } from './hotel-extra-reservations.controller';
import { HotelExtraReservationsService } from './hotel-extra-reservations.service';

@Module({
  controllers: [HotelExtraReservationsController],
  providers: [HotelExtraReservationsService],
})
export class HotelExtraReservationsModule {}
