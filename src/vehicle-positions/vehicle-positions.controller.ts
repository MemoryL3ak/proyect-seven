import { Public } from '../auth/public.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateVehiclePositionDto } from './dto/create-vehicle-position.dto';
import { UpdateVehiclePositionDto } from './dto/update-vehicle-position.dto';
import { VehiclePositionsService } from './vehicle-positions.service';
import { VehiclePositionsAccessService } from './vehicle-positions.access.service';
import type { VpRequest } from './vehicle-positions.access.service';
import { VehiclePositionsGuard } from './vehicle-positions.guard';

/**
 * SA-BACKEND-02: todo el módulo exige autenticación (guard) y cada endpoint
 * acota la autorización a la participación del solicitante en el viaje.
 */
@UseGuards(VehiclePositionsGuard)
@Controller('vehicle-positions')
export class VehiclePositionsController {
  constructor(
    private readonly vehiclePositionsService: VehiclePositionsService,
    private readonly access: VehiclePositionsAccessService,
  ) {}

  /** Ingesta GPS del shell nativo: excluida del guard global mientras dure el modo transicional (VehiclePositionsGuard decide). */
  @Public()
  @Post()
  async create(
    @Body() createVehiclePositionDto: CreateVehiclePositionDto,
    @Req() req: VpRequest,
  ) {
    await this.access.assertCanIngest(req.vpCaller, createVehiclePositionDto);
    return this.vehiclePositionsService.create(createVehiclePositionDto);
  }

  @Get()
  findAll(@Req() req: VpRequest) {
    this.access.requireStaff(req.vpCaller);
    return this.vehiclePositionsService.findAll();
  }

  @Get('by-vehicle/:vehicleId')
  async findLatestByVehicle(
    @Param('vehicleId') vehicleId: string,
    @Req() req: VpRequest,
  ) {
    await this.access.assertCanReadVehicle(req.vpCaller, vehicleId);
    return this.vehiclePositionsService.findLatestByVehicle(vehicleId);
  }

  @Get('by-driver/:driverId')
  async findLatestByDriver(
    @Param('driverId') driverId: string,
    @Req() req: VpRequest,
  ) {
    await this.access.assertCanReadDriver(req.vpCaller, driverId);
    return this.vehiclePositionsService.findLatestByDriver(driverId);
  }

  @Get('by-trip/:tripId')
  async findByTrip(@Param('tripId') tripId: string, @Req() req: VpRequest) {
    await this.access.assertCanReadTrip(req.vpCaller, tripId);
    return this.vehiclePositionsService.findByTrip(tripId);
  }

  @Get('by-trip/:tripId/latest')
  async findLatestByTrip(
    @Param('tripId') tripId: string,
    @Req() req: VpRequest,
  ) {
    await this.access.assertCanReadTrip(req.vpCaller, tripId);
    return this.vehiclePositionsService.findLatestByTrip(tripId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: VpRequest) {
    this.access.requireStaff(req.vpCaller);
    return this.vehiclePositionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateVehiclePositionDto: UpdateVehiclePositionDto,
    @Req() req: VpRequest,
  ) {
    this.access.requireStaff(req.vpCaller);
    return this.vehiclePositionsService.update(id, updateVehiclePositionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: VpRequest) {
    this.access.requireStaff(req.vpCaller);
    return this.vehiclePositionsService.remove(id);
  }
}
