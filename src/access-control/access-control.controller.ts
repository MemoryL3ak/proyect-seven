import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { ScanDto } from './dto/scan.dto';

@Controller('access-control')
export class AccessControlController {
  constructor(private readonly service: AccessControlService) {}

  @Post('scan')
  scan(@Body() dto: ScanDto) {
    return this.service.scan(dto);
  }

  @Post('request-access')
  requestAccess(@Body() payload: { email: string }) {
    return this.service.requestAccess(payload.email);
  }

  @Get('scans')
  listRecent(@Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : 50;
    return this.service.listRecent(Number.isFinite(parsed) ? parsed : 50);
  }
}
