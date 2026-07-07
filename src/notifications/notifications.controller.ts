import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
  ClearNotificationsDto,
  ListNotificationsDto,
  MarkReadDto,
} from './dto/list-notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@Query() query: ListNotificationsDto) {
    return this.service.list({
      userKind: query.userKind,
      userId: query.userId,
    });
  }

  @Post('mark-read')
  markRead(@Body() dto: MarkReadDto) {
    return this.service.markRead(
      { userKind: dto.userKind, userId: dto.userId },
      dto.ids,
    );
  }

  @Post('clear')
  clear(@Body() dto: ClearNotificationsDto) {
    return this.service.clear({
      userKind: dto.userKind,
      userId: dto.userId,
    });
  }
}
