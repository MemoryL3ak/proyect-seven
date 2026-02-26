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
import { BulkCreateSportsCalendarEventsDto } from './dto/bulk-create-sports-calendar-events.dto';
import { CreateSportsCalendarEventDto } from './dto/create-sports-calendar-event.dto';
import { QuerySportsCalendarEventsDto } from './dto/query-sports-calendar-events.dto';
import { UpdateSportsCalendarEventDto } from './dto/update-sports-calendar-event.dto';
import { SportsCalendarService } from './sports-calendar.service';

@Controller('sports-calendar/events')
export class SportsCalendarController {
  constructor(private readonly sportsCalendarService: SportsCalendarService) {}

  @Post()
  create(@Body() dto: CreateSportsCalendarEventDto) {
    return this.sportsCalendarService.create(dto);
  }

  @Post('bulk')
  createBulk(@Body() dto: BulkCreateSportsCalendarEventsDto) {
    return this.sportsCalendarService.createBulk(dto.events);
  }

  @Get()
  findAll(@Query() filters: QuerySportsCalendarEventsDto) {
    return this.sportsCalendarService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sportsCalendarService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSportsCalendarEventDto) {
    return this.sportsCalendarService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sportsCalendarService.remove(id);
  }
}
