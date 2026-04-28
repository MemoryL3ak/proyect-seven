import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateChatDto,
  SendMessageDto,
  UpdateChatDto,
} from './dto/create-chat.dto';
import { SupportChatsService } from './support-chats.service';

@Controller('support-chats')
export class SupportChatsController {
  constructor(private readonly service: SupportChatsService) {}

  @Post()
  create(@Body() dto: CreateChatDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('originType') originType?: string,
    @Query('originId') originId?: string,
    @Query('agentId') agentId?: string,
  ) {
    return this.service.findAll({ status, originType, originId, agentId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateChatDto) {
    return this.service.update(id, dto);
  }

  @Get(':id/messages')
  listMessages(
    @Param('id') id: string,
    @Query('includeInternal') includeInternal?: string,
  ) {
    const include = includeInternal !== 'false';
    return this.service.listMessages(id, include);
  }

  @Post(':id/messages')
  sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.service.sendMessage(id, dto);
  }
}
