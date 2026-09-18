import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import { FoodMenusService } from './food-menus.service';
import type { ApiRequest } from '../auth/api-auth.guard';
import { StaffScopeService } from '../auth/staff-scope.service';
import { CreateFoodMenuDto } from './dto/create-food-menu.dto';
import { UpdateFoodMenuDto } from './dto/update-food-menu.dto';

@Controller('food-menus')
export class FoodMenusController {
  constructor(
    private readonly foodMenusService: FoodMenusService,
    private readonly scope: StaffScopeService,
  ) {}

  @Post()
  create(@Body() dto: CreateFoodMenuDto) {
    return this.foodMenusService.create(dto);
  }

  @Get()
  async findAll(
    @Req() req: ApiRequest,
    @Query('month') month?: string,
    @Query('accommodationId') accommodationId?: string,
  ) {
    // Jefe de Misión: sólo los menús de los hoteles de su delegación.
    return this.foodMenusService.findAll({ month, accommodationId }, await this.scope.delegationOf(req));
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
