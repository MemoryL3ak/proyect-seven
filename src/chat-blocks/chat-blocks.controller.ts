import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { ApiRequest } from '../auth/api-auth.guard';
import { ChatBlocksService } from './chat-blocks.service';

/**
 * Bloqueo de chat de viaje (SA-BACKEND-04 · 2). Protegido por el guard
 * global; cada usuario consulta y administra únicamente sus propios bloqueos
 * (la identidad sale del llamador autenticado).
 */
@Controller('chat-blocks')
export class ChatBlocksController {
  constructor(private readonly chatBlocksService: ChatBlocksService) {}

  private caller(req: ApiRequest) {
    const caller = req.apiCaller;
    if (!caller) throw new UnauthorizedException('Autenticación requerida');
    return caller;
  }

  @Get(':tripId')
  async get(@Param('tripId') tripId: string, @Req() req: ApiRequest) {
    const blocked = await this.chatBlocksService.isBlocked(this.caller(req), tripId);
    return { tripId, blocked };
  }

  @Post(':tripId')
  async block(@Param('tripId') tripId: string, @Req() req: ApiRequest) {
    await this.chatBlocksService.block(this.caller(req), tripId);
    return { tripId, blocked: true };
  }

  @Delete(':tripId')
  async unblock(@Param('tripId') tripId: string, @Req() req: ApiRequest) {
    await this.chatBlocksService.unblock(this.caller(req), tripId);
    return { tripId, blocked: false };
  }
}
