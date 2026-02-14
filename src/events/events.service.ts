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
  country: string | null;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  config: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
};

type EventDisciplineRow = {
  event_id: string;
  discipline_id: string;
};

type DisciplineRow = {
  id: string;
  name: string;
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
    if (dto.startDate !== undefined) {
      row.start_date = dto.startDate ?? null;
    }
    if (dto.endDate !== undefined) {
      row.end_date = dto.endDate ?? null;
    }
    if (dto.country !== undefined) {
      row.country = dto.country ?? null;
    }
    if (dto.city !== undefined) {
      row.city = dto.city ?? null;
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
      country: row.country ?? null,
      city: row.city ?? null,
      startDate: row.start_date ? new Date(row.start_date) : null,
      endDate: row.end_date ? new Date(row.end_date) : null,
      config: row.config,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async attachDisciplines(events: Event[]) {
    if (events.length === 0) return events;
    const eventIds = events.map((item) => item.id);

    const { data: links, error: linksError } = await this.supabase
      .schema('core')
      .from('event_disciplines')
      .select('event_id, discipline_id')
      .in('event_id', eventIds);

    if (linksError) {
      throw new InternalServerErrorException(
        linksError.message || 'Error fetching event disciplines',
      );
    }

    const safeLinks = (links ?? []) as EventDisciplineRow[];
    if (safeLinks.length === 0) {
      return events.map((event) => ({
        ...event,
        disciplineIds: [],
        disciplineNames: [],
      }));
    }

    const disciplineIds = Array.from(
      new Set(safeLinks.map((link) => link.discipline_id)),
    );

    const { data: disciplines, error: disciplinesError } = await this.supabase
      .schema('core')
      .from('disciplines')
      .select('id, name')
      .in('id', disciplineIds);

    if (disciplinesError) {
      throw new InternalServerErrorException(
        disciplinesError.message || 'Error fetching disciplines',
      );
    }

    const disciplineMap = new Map<string, string>();
    (disciplines ?? []).forEach((discipline) => {
      const row = discipline as DisciplineRow;
      disciplineMap.set(row.id, row.name);
    });

    const byEvent = new Map<string, string[]>();
    safeLinks.forEach((link) => {
      const current = byEvent.get(link.event_id) ?? [];
      current.push(link.discipline_id);
      byEvent.set(link.event_id, current);
    });

    return events.map((event) => {
      const ids = byEvent.get(event.id) ?? [];
      const names = ids
        .map((id) => disciplineMap.get(id))
        .filter((name): name is string => Boolean(name));
      return {
        ...event,
        disciplineIds: ids,
        disciplineNames: names,
      };
    });
  }

  private async setEventDisciplines(eventId: string, disciplineIds: string[]) {
    const { error: deleteError } = await this.supabase
      .schema('core')
      .from('event_disciplines')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      throw new InternalServerErrorException(
        deleteError.message || 'Error clearing event disciplines',
      );
    }

    if (disciplineIds.length === 0) return;

    const payload = disciplineIds.map((disciplineId) => ({
      event_id: eventId,
      discipline_id: disciplineId,
    }));

    const { error: insertError } = await this.supabase
      .schema('core')
      .from('event_disciplines')
      .insert(payload);

    if (insertError) {
      throw new InternalServerErrorException(
        insertError.message || 'Error assigning event disciplines',
      );
    }
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

    if (createEventDto.disciplineIds) {
      await this.setEventDisciplines(
        (data as EventRow).id,
        createEventDto.disciplineIds,
      );
    }

    return this.findOne((data as EventRow).id);
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

    const events = (data ?? []).map((row) => this.toEntity(row as EventRow));
    return this.attachDisciplines(events);
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

    const event = this.toEntity(data as EventRow);
    const [withDisciplines] = await this.attachDisciplines([event]);
    return withDisciplines;
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

    if (updateEventDto.disciplineIds) {
      await this.setEventDisciplines(id, updateEventDto.disciplineIds);
    }

    return this.findOne(id);
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
