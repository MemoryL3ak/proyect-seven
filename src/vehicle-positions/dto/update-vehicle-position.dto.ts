import { PartialType } from '@nestjs/mapped-types';
import { CreateVehiclePositionDto } from './create-vehicle-position.dto';

export class UpdateVehiclePositionDto extends PartialType(
  CreateVehiclePositionDto,
) {}
