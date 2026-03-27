import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { FoodMenusService } from './food-menus.service';
import { CreateFoodMenuDto } from './dto/create-food-menu.dto';
import { UpdateFoodMenuDto } from './dto/update-food-menu.dto';

@Controller('food-menus')
export class FoodMenusController {
  constructor(private readonly foodMenusService: FoodMenusService) {}

  @Post()
  create(@Body() dto: CreateFoodMenuDto) {
    return this.foodMenusService.create(dto);
  }

  @Get()
  findAll(
    @Query('month') month?: string,
    @Query('accommodationId') accommodationId?: string,
  ) {
    return this.foodMenusService.findAll({ month, accommodationId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.foodMenusService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFoodMenuDto) {
    return this.foodMenusService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.foodMenusService.remove(id);
  }
}
