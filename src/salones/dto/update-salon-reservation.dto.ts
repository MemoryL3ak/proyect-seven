import { PartialType } from '@nestjs/mapped-types';
import { CreateSalonReservationDto } from './create-salon-reservation.dto';

export class UpdateSalonReservationDto extends PartialType(CreateSalonReservationDto) {}
