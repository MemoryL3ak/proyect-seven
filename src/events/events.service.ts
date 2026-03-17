import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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

type EventExpectedCapacityRow = {
  event_id: string;
  discipline_id: string;
  delegation_code: string;
  expected_count: number;
};

type EventExpectedCapacityInput = {
  disciplineId: string;
  delegationCode: string;
  expectedCount: number;
};

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly dataSource: DataSource,
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
    if (dto.config !== undefined) {
      row.config = dto.config ?? {};
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

    const safeLinks = (await this.dataSource.query(
      `
        select event_id, discipline_id
        from core.event_disciplines
        where event_id = any($1::uuid[])
      `,
      [eventIds],
    )) as EventDisciplineRow[];

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

    const disciplines = (await this.dataSource.query(
      `
        select id, name
        from core.disciplines
        where id = any($1::uuid[])
      `,
      [disciplineIds],
    )) as DisciplineRow[];

    const disciplineMap = new Map<string, string>();
    disciplines.forEach((discipline) => {
      disciplineMap.set(discipline.id, discipline.name);
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
        .map((disciplineId) => disciplineMap.get(disciplineId))
        .filter((name): name is string => Boolean(name));
      return {
        ...event,
        disciplineIds: ids,
        disciplineNames: names,
      };
    });
  }

  private async setEventDisciplines(eventId: string, disciplineIds: string[]) {
    await this.dataSource.query(
      `
      delete from core.event_disciplines
      where event_id = $1
    `,
      [eventId],
    );

    if (disciplineIds.length === 0) return;
    for (const disciplineId of disciplineIds) {
      await this.dataSource.query(
        `
        insert into core.event_disciplines (event_id, discipline_id)
        values ($1, $2)
      `,
        [eventId, disciplineId],
      );
    }
  }

  private async setEventExpectedCapacities(
    eventId: string,
    capacities: EventExpectedCapacityInput[],
  ) {
    await this.dataSource.query(
      `
      delete from core.event_expected_capacities
      where event_id = $1
    `,
      [eventId],
    );

    if (!capacities || capacities.length === 0) return;

    const payload = capacities
      .filter(
        (item) =>
          item?.disciplineId &&
          item?.delegationCode &&
          Number.isFinite(Number(item.expectedCount)) &&
          Number(item.expectedCount) >= 0,
      )
      .map((item) => ({
        event_id: eventId,
        discipline_id: item.disciplineId,
        delegation_code: item.delegationCode.trim().toUpperCase(),
        expected_count: Math.floor(Number(item.expectedCount)),
      }));

    const dedupedPayload = Array.from(
      new Map(
        payload.map((item) => [
          `${item.event_id}::${item.discipline_id}::${item.delegation_code}`,
          item,
        ]),
      ).values(),
    );

    if (dedupedPayload.length === 0) return;
    for (const item of dedupedPayload) {
      await this.dataSource.query(
        `
        insert into core.event_expected_capacities (
          event_id,
          discipline_id,
          delegation_code,
          expected_count
        ) values ($1, $2, $3, $4)
        on conflict (event_id, discipline_id, delegation_code)
        do update set expected_count = excluded.expected_count
      `,
        [
          item.event_id,
          item.discipline_id,
          item.delegation_code,
          item.expected_count,
        ],
      );
    }
  }

  private async attachExpectedCapacities(events: Event[]) {
    if (events.length === 0) return events;

    const eventIds = events.map((item) => item.id);
    const data = (await this.dataSource.query(
      `
        select event_id, discipline_id, delegation_code, expected_count
        from core.event_expected_capacities
        where event_id = any($1::uuid[])
      `,
      [eventIds],
    )) as EventExpectedCapacityRow[];

    const byEvent = new Map<
      string,
      Array<{ disciplineId: string; delegationCode: string; expectedCount: number }>
    >();
    data.forEach((row) => {
      const current = byEvent.get(row.event_id) ?? [];
      current.push({
        disciplineId: row.discipline_id,
        delegationCode: row.delegation_code,
        expectedCount: Number(row.expected_count ?? 0),
      });
      byEvent.set(row.event_id, current);
    });

    return events.map((event) => ({
      ...event,
      expectedCapacities: byEvent.get(event.id) ?? [],
    }));
  }

  async create(createEventDto: CreateEventDto) {
    const row = this.toRow(createEventDto);
    const keys = Object.keys(row);
    const columns = keys.join(', ');
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const values = keys.map((key) => row[key]);

    const rows = (await this.dataSource.query(
      `
      insert into core.events (${columns})
      values (${placeholders})
      returning *
    `,
      values,
    )) as EventRow[];

    if (!rows[0]) {
      throw new InternalServerErrorException('Error creating event');
    }

    if (createEventDto.disciplineIds) {
      await this.setEventDisciplines(
        rows[0].id,
        createEventDto.disciplineIds,
      );
    }
    if (createEventDto.expectedCapacities !== undefined) {
      await this.setEventExpectedCapacities(
        rows[0].id,
        createEventDto.expectedCapacities,
      );
    }

    return this.findOne(rows[0].id);
  }

  async findAll() {
    try {
      const events = await this.eventRepository.find({
        order: { createdAt: 'DESC' },
      });
      const withDisciplines = await this.attachDisciplines(events);
      return await this.attachExpectedCapacities(withDisciplines);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching events',
      );
    }
  }

  async findOne(id: string) {
    let event: Event | null;
    try {
      event = await this.eventRepository.findOne({ where: { id } });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching event',
      );
    }

    if (!event) {
      throw new NotFoundException(`Event with id ${id} not found`);
    }

    const [withDisciplines] = await this.attachDisciplines([event]);
    const [withExpectedCapacities] = await this.attachExpectedCapacities([
      withDisciplines,
    ]);
    return withExpectedCapacities;
  }

  async update(id: string, updateEventDto: UpdateEventDto) {
    const row = this.toRow(updateEventDto);
    const keys = Object.keys(row);
    if (keys.length > 0) {
      const setSql = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = keys.map((key) => row[key]);
      const rows = (await this.dataSource.query(
        `
        update core.events
        set ${setSql}, updated_at = now()
        where id = $1
        returning id
      `,
        [id, ...values],
      )) as Array<{ id: string }>;
      if (!rows[0]) {
        throw new NotFoundException(`Event with id ${id} not found`);
      }
    }

    if (updateEventDto.disciplineIds) {
      await this.setEventDisciplines(id, updateEventDto.disciplineIds);
    }
    if (updateEventDto.expectedCapacities !== undefined) {
      await this.setEventExpectedCapacities(id, updateEventDto.expectedCapacities);
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    const rows = (await this.dataSource.query(
      `
      delete from core.events
      where id = $1
      returning *
    `,
      [id],
    )) as EventRow[];

    if (!rows[0]) {
      throw new NotFoundException(`Event with id ${id} not found`);
    }

    return this.toEntity(rows[0]);
  }
}
