import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { FoodLocationsService } from './food-locations.service';
import { CreateFoodLocationDto } from './dto/create-food-location.dto';
import { UpdateFoodLocationDto } from './dto/update-food-location.dto';

@Controller('food-locations')
export class FoodLocationsController {
  constructor(private readonly foodLocationsService: FoodLocationsService) {}

  @Post()
  create(@Body() dto: CreateFoodLocationDto) {
    return this.foodLocationsService.create(dto);
  }

  @Get()
  findAll() {
    return this.foodLocationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.foodLocationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFoodLocationDto) {
    return this.foodLocationsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.foodLocationsService.remove(id);
  }
}
