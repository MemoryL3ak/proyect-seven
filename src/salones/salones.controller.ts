import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { SalonesService } from './salones.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { CreateSalonReservationDto } from './dto/create-salon-reservation.dto';
import { UpdateSalonReservationDto } from './dto/update-salon-reservation.dto';

@Controller('salones')
export class SalonesController {
  constructor(private readonly salonesService: SalonesService) {}

  // ── Salones ──────────────────────────────────────────────
  @Post() createSalon(@Body() dto: CreateSalonDto) { return this.salonesService.createSalon(dto); }
  @Get() findAllSalones() { return this.salonesService.findAllSalones(); }
  @Get(':id') findOneSalon(@Param('id') id: string) { return this.salonesService.findOneSalon(id); }
  @Patch(':id') updateSalon(@Param('id') id: string, @Body() dto: UpdateSalonDto) { return this.salonesService.updateSalon(id, dto); }
  @Delete(':id') removeSalon(@Param('id') id: string) { return this.salonesService.removeSalon(id); }

  // ── Reservations ─────────────────────────────────────────
  @Post('reservations') createReservation(@Body() dto: CreateSalonReservationDto) { return this.salonesService.createReservation(dto); }
  @Get('reservations/all') findAllReservations() { return this.salonesService.findAllReservations(); }
  @Get('reservations/:id') findOneReservation(@Param('id') id: string) { return this.salonesService.findOneReservation(id); }
  @Patch('reservations/:id') updateReservation(@Param('id') id: string, @Body() dto: UpdateSalonReservationDto) { return this.salonesService.updateReservation(id, dto); }
  @Delete('reservations/:id') removeReservation(@Param('id') id: string) { return this.salonesService.removeReservation(id); }
}
