import { PartialType } from '@nestjs/mapped-types';
import { CreateHotelExtraReservationDto } from './create-hotel-extra-reservation.dto';

export class UpdateHotelExtraReservationDto extends PartialType(CreateHotelExtraReservationDto) {}
