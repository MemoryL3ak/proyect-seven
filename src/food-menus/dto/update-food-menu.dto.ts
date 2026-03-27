import { PartialType } from '@nestjs/mapped-types';
import { CreateFoodMenuDto } from './create-food-menu.dto';

export class UpdateFoodMenuDto extends PartialType(CreateFoodMenuDto) {}
