import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateVehiclePositionDto } from './dto/create-vehicle-position.dto';
import { UpdateVehiclePositionDto } from './dto/update-vehicle-position.dto';
import { VehiclePositionsService } from './vehicle-positions.service';

@Controller('vehicle-positions')
export class VehiclePositionsController {
  constructor(private readonly vehiclePositionsService: VehiclePositionsService) {}

  @Post()
  create(@Body() createVehiclePositionDto: CreateVehiclePositionDto) {
    return this.vehiclePositionsService.create(createVehiclePositionDto);
  }

  @Get()
  findAll() {
    return this.vehiclePositionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehiclePositionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateVehiclePositionDto: UpdateVehiclePositionDto,
  ) {
    return this.vehiclePositionsService.update(id, updateVehiclePositionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vehiclePositionsService.remove(id);
  }
}
