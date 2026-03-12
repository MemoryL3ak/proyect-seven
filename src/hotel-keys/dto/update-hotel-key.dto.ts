import { PartialType } from '@nestjs/mapped-types';
import { CreateHotelKeyDto } from './create-hotel-key.dto';

export class UpdateHotelKeyDto extends PartialType(CreateHotelKeyDto) {}
