import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { ApiRequest } from '../auth/api-auth.guard';
import { StaffScopeService } from '../auth/staff-scope.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { FlightsService } from './flights.service';

@Controller('flights')
export class FlightsController {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly scope: StaffScopeService,
  ) {}

  /**
   * Llegadas y salidas del evento con su traslado, para la pestaña Vuelos de
   * la app del Coordinador de Sede (28-09-2026). Desde la app el evento es
   * el de su ficha, no el que pida; sólo nombres, delegación, vuelos y el
   * estado del traslado, sin datos de contacto.
   */
  @Get('evento')
  async vuelosDelEvento(@Req() req: ApiRequest, @Query('eventId') eventId?: string) {
    const acceso = await this.scope.requireMonitorVuelos(req);
    const evento = acceso.eventId ?? eventId ?? null;
    if (!evento) return [];
    return this.flightsService.vuelosDelEvento(evento);
  }

  @Post()
  create(@Body() createFlightDto: CreateFlightDto) {
    return this.flightsService.create(createFlightDto);
  }

  @Get()
  findAll() {
    return this.flightsService.findAll();
  }

  @Get('lookup-airline')
  lookupAirline(@Query('flightNumber') flightNumber: string) {
    return this.flightsService.lookupAirline(flightNumber);
  }

  @Get('airport-arrivals')
  airportArrivals(
    @Query('iata') iata: string,
    @Query('hours') hours?: string,
  ) {
    return this.flightsService.airportArrivals(
      iata,
      hours ? Number(hours) : undefined,
    );
  }

  @Get('track')
  trackFlight(
    @Query('flightNumber') flightNumber: string,
    @Query('flightDate') flightDate?: string,
  ) {
    return this.flightsService.trackFlight(flightNumber, flightDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.flightsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFlightDto: UpdateFlightDto) {
    return this.flightsService.update(id, updateFlightDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.flightsService.remove(id);
  }
}
