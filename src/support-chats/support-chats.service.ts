import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  CreateChatDto,
  SendMessageDto,
  UpdateChatDto,
} from './dto/create-chat.dto';

@Injectable()
export class SupportChatsService {
  constructor(@Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient) {}

  async create(dto: CreateChatDto) {
    const row = {
      event_id: dto.eventId ?? null,
      origin_type: dto.originType,
      origin_id: dto.originId,
      origin_name: dto.originName,
      category: dto.category ?? 'QUERY',
      priority: dto.priority ?? 'NORMAL',
      subject: dto.subject ?? null,
      status: 'OPEN',
    };
    const { data, error } = await this.supabase
      .schema('core')
      .from('support_chats')
      .insert(row)
      .select('*')
      .single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message || 'Error creating chat');
    }

    if (dto.initialMessage?.trim()) {
      await this.sendMessage(data.id, {
        senderType: 'origin',
        senderId: dto.originId,
        senderName: dto.originName,
        content: dto.initialMessage.trim(),
      });
    }

    return this.findOne(data.id);
  }

  async findAll(filter?: {
    status?: string;
    originType?: string;
    originId?: string;
    agentId?: string;
  }) {
    let query = this.supabase
      .schema('core')
      .from('support_chats')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (filter?.status) query = query.eq('status', filter.status);
    if (filter?.originType) query = query.eq('origin_type', filter.originType);
    if (filter?.originId) query = query.eq('origin_id', filter.originId);
    if (filter?.agentId) query = query.eq('agent_id', filter.agentId);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('support_chats')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Chat ${id} no encontrado`);
    return data;
  }

  async update(id: string, dto: UpdateChatDto) {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.status !== undefined) {
      row.status = dto.status;
      if (dto.status === 'RESOLVED' || dto.status === 'CLOSED') {
        row.resolved_at = new Date().toISOString();
      }
    }
    if (dto.category !== undefined) row.category = dto.category;
    if (dto.priority !== undefined) row.priority = dto.priority;
    if (dto.subject !== undefined) row.subject = dto.subject;
    if (dto.agentId !== undefined) {
      row.agent_id = dto.agentId;
      // First time an agent takes → record first_response_at
      const current = await this.findOne(id);
      if (!current.agent_id && !current.first_response_at) {
        row.first_response_at = new Date().toISOString();
      }
    }
    if (dto.agentName !== undefined) row.agent_name = dto.agentName;

    const { data, error } = await this.supabase
      .schema('core')
      .from('support_chats')
      .update(row)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Chat ${id} no encontrado`);
    return data;
  }

  async sendMessage(chatId: string, dto: SendMessageDto) {
    await this.findOne(chatId); // ensure exists

    const row = {
      chat_id: chatId,
      sender_type: dto.senderType,
      sender_id: dto.senderId ?? null,
      sender_name: dto.senderName ?? null,
      content: dto.content ?? null,
      attachments: dto.attachments ?? [],
      is_internal_note: dto.isInternalNote ?? false,
    };

    const { data, error } = await this.supabase
      .schema('core')
      .from('support_messages')
      .insert(row)
      .select('*')
      .single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message || 'Error sending message');
    }

    // If an agent is responding and chat was OPEN → move to IN_ATTENTION
    if (dto.senderType === 'agent' && !dto.isInternalNote) {
      const current = await this.findOne(chatId);
      if (current.status === 'OPEN') {
        await this.update(chatId, {
          status: 'IN_ATTENTION',
          agentId: dto.senderId,
          agentName: dto.senderName,
        });
      }
    }

    return data;
  }

  async listMessages(chatId: string, includeInternal = true) {
    await this.findOne(chatId);
    let query = this.supabase
      .schema('core')
      .from('support_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (!includeInternal) {
      query = query.eq('is_internal_note', false);
    }
    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }
}
