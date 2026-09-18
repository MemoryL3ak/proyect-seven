import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { FoodLocationsService } from './food-locations.service';
import type { ApiRequest } from '../auth/api-auth.guard';
import { StaffScopeService } from '../auth/staff-scope.service';
import { CreateFoodLocationDto } from './dto/create-food-location.dto';
import { UpdateFoodLocationDto } from './dto/update-food-location.dto';

@Controller('food-locations')
export class FoodLocationsController {
  constructor(
    private readonly foodLocationsService: FoodLocationsService,
    private readonly scope: StaffScopeService,
  ) {}

  @Post()
  create(@Body() dto: CreateFoodLocationDto) {
    return this.foodLocationsService.create(dto);
  }

  @Get()
  async findAll(@Req() req: ApiRequest) {
    // Jefe de Misión: sólo la alimentación de los hoteles de su delegación.
    return this.foodLocationsService.findAll(await this.scope.delegationOf(req));
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
