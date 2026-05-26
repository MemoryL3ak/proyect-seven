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
import {
  CreateDeliveryDto,
  CreatePersonDto,
  CreateProductDto,
  UpdateDeliveryDto,
  UpdatePersonDto,
  UpdateProductDto,
} from './dto/workforce.dto';
import { WorkforceService } from './workforce.service';

@Controller('workforce')
export class WorkforceController {
  constructor(private readonly service: WorkforceService) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────

  @Get('dashboard')
  dashboard(@Query('eventId') eventId?: string) {
    return this.service.getDashboard(eventId);
  }

  // ── Persons ────────────────────────────────────────────────────────────────

  @Get('persons')
  listPersons(
    @Query('personType') personType?: string,
    @Query('eventId') eventId?: string,
    @Query('q') q?: string,
  ) {
    return this.service.listPersons({ personType, eventId, q });
  }

  @Get('persons/:id')
  getPerson(@Param('id') id: string) {
    return this.service.getPerson(id);
  }

  @Post('persons')
  createPerson(@Body() dto: CreatePersonDto) {
    return this.service.createPerson(dto);
  }

  @Patch('persons/:id')
  updatePerson(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return this.service.updatePerson(id, dto);
  }

  @Delete('persons/:id')
  deletePerson(@Param('id') id: string) {
    return this.service.deletePerson(id);
  }

  // ── Products ───────────────────────────────────────────────────────────────

  @Get('products')
  listProducts(@Query('eventId') eventId?: string) {
    return this.service.listProducts({ eventId });
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.service.createProduct(dto);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.updateProduct(id, dto);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.service.deleteProduct(id);
  }

  // ── Deliveries ─────────────────────────────────────────────────────────────

  @Get('deliveries')
  listDeliveries(
    @Query('personId') personId?: string,
    @Query('productId') productId?: string,
    @Query('validated') validated?: string,
  ) {
    return this.service.listDeliveries({
      personId,
      productId,
      validated:
        validated === 'true' ? true : validated === 'false' ? false : undefined,
    });
  }

  @Post('deliveries')
  createDelivery(@Body() dto: CreateDeliveryDto) {
    return this.service.createDelivery(dto);
  }

  @Patch('deliveries/:id')
  updateDelivery(@Param('id') id: string, @Body() dto: UpdateDeliveryDto) {
    return this.service.updateDelivery(id, dto);
  }

  @Patch('deliveries/:id/validate')
  validateDelivery(
    @Param('id') id: string,
    @Body() body: { validatedBy: string },
  ) {
    return this.service.validateDelivery(id, body.validatedBy);
  }

  @Delete('deliveries/:id')
  deleteDelivery(@Param('id') id: string) {
    return this.service.deleteDelivery(id);
  }
}
