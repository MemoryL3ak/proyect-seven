import { PartialType } from '@nestjs/mapped-types';
import { CreateHotelBedDto } from './create-hotel-bed.dto';

export class UpdateHotelBedDto extends PartialType(CreateHotelBedDto) {}
