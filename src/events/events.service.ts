import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from './entities/event.entity';

type EventRow = {
  id: string;
  name: string;
  config: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class EventsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  private toRow(dto: CreateEventDto | UpdateEventDto) {
    const row: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      row.name = dto.name;
    }
    if (dto.config !== undefined) {
      row.config = dto.config ?? {};
    }
    if (dto.status !== undefined) {
      row.status = dto.status;
    }

    return row;
  }

  private toEntity(row: EventRow): Event {
    return {
      id: row.id,
      name: row.name,
      config: row.config,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(createEventDto: CreateEventDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('events')
      .insert(this.toRow(createEventDto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating event',
      );
    }

    return this.toEntity(data as EventRow);
  }

  async findAll() {
    const { data, error } = await this.supabase
      .schema('core')
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching events',
      );
    }

    return (data ?? []).map((row) => this.toEntity(row as EventRow));
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching event',
      );
    }

    if (!data) {
      throw new NotFoundException(`Event with id ${id} not found`);
    }

    return this.toEntity(data as EventRow);
  }

  async update(id: string, updateEventDto: UpdateEventDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('events')
      .update(this.toRow(updateEventDto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating event',
      );
    }

    if (!data) {
      throw new NotFoundException(`Event with id ${id} not found`);
    }

    return this.toEntity(data as EventRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('events')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting event',
      );
    }

    if (!data) {
      throw new NotFoundException(`Event with id ${id} not found`);
    }

    return this.toEntity(data as EventRow);
  }
}
