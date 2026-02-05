import { Body, Controller, Post } from '@nestjs/common';
import { AskSofiaDto } from './dto/ask-sofia.dto';
import { SofiaService } from './sofia.service';

@Controller('sofia')
export class SofiaController {
  constructor(private readonly sofiaService: SofiaService) {}

  @Post('ask')
  async ask(@Body() dto: AskSofiaDto) {
    return this.sofiaService.ask(dto.question, dto.previousResponseId);
  }
}
