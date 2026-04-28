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
import { CreatePremiacionDto } from './dto/create-premiacion.dto';
import { UpdatePremiacionDto } from './dto/update-premiacion.dto';
import { PremiacionesService } from './premiaciones.service';

@Controller('premiaciones')
export class PremiacionesController {
  constructor(private readonly service: PremiacionesService) {}

  @Post()
  create(@Body() dto: CreatePremiacionDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('athleteId') athleteId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAll({ athleteId, from, to });
  }

  @Get('by-athlete/:athleteId')
  findByAthlete(@Param('athleteId') athleteId: string) {
    return this.service.findByAthlete(athleteId);
  }

  @Get('by-sports-event/:sportsEventId')
  findBySportsEvent(@Param('sportsEventId') sportsEventId: string) {
    return this.service.findBySportsEvent(sportsEventId);
  }

  @Get('by-discipline/:disciplineId')
  findByDiscipline(@Param('disciplineId') disciplineId: string) {
    return this.service.findByDiscipline(disciplineId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePremiacionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/awarders/:awarderId/confirm')
  confirm(@Param('id') id: string, @Param('awarderId') awarderId: string) {
    return this.service.confirmAwarder(id, awarderId, 'CONFIRM');
  }

  @Patch(':id/awarders/:awarderId/decline')
  decline(@Param('id') id: string, @Param('awarderId') awarderId: string) {
    return this.service.confirmAwarder(id, awarderId, 'DECLINE');
  }
}
