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
import { FoodLocationsService } from './food-locations.service';
import type { ApiRequest } from '../auth/api-auth.guard';
import { StaffScopeService } from '../auth/staff-scope.service';
import { eventoValido } from '../shared/evento-conductores';
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
  async findAll(@Req() req: ApiRequest, @Query('eventId') eventId?: string) {
    // Jefe de Misión: sólo la alimentación de los hoteles de su delegación.
    // Quien entra por la app ve los comedores de su evento; el panel, los del
    // evento elegido.
    const scope = await this.scope.forRequest(req);
    const delPortal = await this.scope.eventoDelPortal(scope);
    return this.foodLocationsService.findAll(
      scope?.delegationId ?? null,
      delPortal ?? eventoValido(eventId),
    );
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
