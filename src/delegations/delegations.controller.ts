import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { UpdateDelegationDto } from './dto/update-delegation.dto';
import { DelegationsService } from './delegations.service';

@Controller('delegations')
export class DelegationsController {
  constructor(private readonly delegationsService: DelegationsService) {}

  @Post()
  create(@Body() createDelegationDto: CreateDelegationDto) {
    return this.delegationsService.create(createDelegationDto);
  }

  @Get()
  findAll() {
    return this.delegationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.delegationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDelegationDto: UpdateDelegationDto,
  ) {
    return this.delegationsService.update(id, updateDelegationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.delegationsService.remove(id);
  }
}
