import { PartialType } from '@nestjs/mapped-types';
import { CreateHotelExtraDto } from './create-hotel-extra.dto';

export class UpdateHotelExtraDto extends PartialType(CreateHotelExtraDto) {}
