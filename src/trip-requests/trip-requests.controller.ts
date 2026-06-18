import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TripRequestsService } from './trip-requests.service';
import { CreateTripRequestDto } from './dto/create-trip-request.dto';
import { AssignTripRequestDto } from './dto/assign-trip-request.dto';

/**
 * Submódulo dedicado a las solicitudes de viaje T1 y VIP que llegan desde
 * la app. Permite gestionarlas de forma independiente del resto de viajes.
 */
@Controller('trip-requests')
export class TripRequestsController {
  constructor(private readonly service: TripRequestsService) {}

  /** Recibe una nueva solicitud de viaje (sólo T1/VIP). */
  @Post()
  create(@Body() dto: CreateTripRequestDto) {
    return this.service.create(dto);
  }

  /** Lista las solicitudes T1/VIP, con filtros opcionales. */
  @Get()
  findAll(
    @Query('eventId') eventId?: string,
    @Query('status') status?: string,
    @Query('clientType') clientType?: string,
  ) {
    return this.service.findAll({ eventId, status, clientType });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** Asigna conductor/vehículo y agenda la solicitud. */
  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignTripRequestDto) {
    return this.service.assign(id, dto);
  }

  /** Cancela la solicitud. */
  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
