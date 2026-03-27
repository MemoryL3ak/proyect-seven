import { PartialType } from '@nestjs/mapped-types';
import { CreateFoodLocationDto } from './create-food-location.dto';

export class UpdateFoodLocationDto extends PartialType(CreateFoodLocationDto) {}
