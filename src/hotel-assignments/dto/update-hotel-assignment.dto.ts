import { PartialType } from '@nestjs/mapped-types';
import { CreateHotelAssignmentDto } from './create-hotel-assignment.dto';

export class UpdateHotelAssignmentDto extends PartialType(
  CreateHotelAssignmentDto,
) {}
