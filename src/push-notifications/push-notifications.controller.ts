import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  RegisterTokenDto,
  UnregisterTokenDto,
} from './dto/register-token.dto';
import { PushNotificationsService } from './push-notifications.service';

@Controller('push-notifications')
export class PushNotificationsController {
  constructor(private readonly service: PushNotificationsService) {}

  @Post('register')
  register(@Body() dto: RegisterTokenDto) {
    return this.service.register(dto);
  }

  @Post('unregister')
  unregister(@Body() dto: UnregisterTokenDto) {
    return this.service.unregister(dto.expoToken);
  }

  @Get('recipients')
  recipients() {
    return this.service.listRecipients();
  }

  /**
   * Endpoint de prueba para QA: permite disparar un push a un user específico
   * sin esperar a un evento de dominio. No expone audiencias masivas.
   */
  @Post('test')
  async test(
    @Body()
    dto: {
      userKind: string;
      userId: string;
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
    },
  ) {
    await this.service.send(
      { userKind: dto.userKind, userId: dto.userId },
      {
        title: dto.title ?? 'Prueba',
        body: dto.body ?? 'Push de prueba desde Seven Arena',
        data: dto.data,
      },
    );
    return { ok: true };
  }
}
