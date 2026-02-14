import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateHotelAssignmentDto } from './dto/create-hotel-assignment.dto';
import { UpdateHotelAssignmentDto } from './dto/update-hotel-assignment.dto';
import { HotelAssignmentsService } from './hotel-assignments.service';

@Controller('hotel-assignments')
export class HotelAssignmentsController {
  constructor(private readonly hotelAssignmentsService: HotelAssignmentsService) {}

  @Post()
  create(@Body() dto: CreateHotelAssignmentDto) {
    return this.hotelAssignmentsService.create(dto);
  }

  @Get()
  findAll() {
    return this.hotelAssignmentsService.findAll();
  }

  @Get('by-participant/:participantId')
  findByParticipant(@Param('participantId') participantId: string) {
    return this.hotelAssignmentsService.findByParticipant(participantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hotelAssignmentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHotelAssignmentDto) {
    return this.hotelAssignmentsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.hotelAssignmentsService.remove(id);
  }
}
