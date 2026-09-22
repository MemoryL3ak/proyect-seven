import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { StaffOnly } from '../auth/staff-only.decorator';
import {
  CreateMealTimeBlockDto,
  UpdateMealTimeBlockDto,
} from './dto/meal-time-block.dto';
import { MealTimeBlocksService } from './meal-time-blocks.service';

/**
 * Horarios de servicio de alimentación.
 *
 * Leerlos es para cualquier sesión —el participante necesita saber hasta qué
 * hora puede ir a comer— y escribirlos es del panel, como el resto de los
 * maestros del evento.
 */
@Controller('meal-time-blocks')
export class MealTimeBlocksController {
  constructor(private readonly service: MealTimeBlocksService) {}

  @Get()
  findAll(@Query('eventId') eventId?: string) {
    return this.service.findAll(eventId);
  }

  @StaffOnly()
  @Post()
  create(@Body() dto: CreateMealTimeBlockDto) {
    return this.service.create(dto);
  }

  @StaffOnly()
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMealTimeBlockDto) {
    return this.service.update(id, dto);
  }

  @StaffOnly()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
