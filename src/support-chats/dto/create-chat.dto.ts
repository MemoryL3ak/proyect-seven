import { IsOptional, IsString } from 'class-validator';

export class CreateChatDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsString()
  originType: string; // driver | athlete | provider_participant

  @IsString()
  originId: string;

  @IsString()
  originName: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  initialMessage?: string;
}

export class SendMessageDto {
  @IsString()
  senderType: string; // origin | agent | system

  @IsOptional()
  @IsString()
  senderId?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  attachments?: unknown[];

  @IsOptional()
  isInternalNote?: boolean;
}

export class UpdateChatDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  agentName?: string;
}
