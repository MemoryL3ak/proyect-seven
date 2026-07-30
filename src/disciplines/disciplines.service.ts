import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SupabaseClient } from '@supabase/supabase-js';
import { Repository } from 'typeorm';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { UpdateDisciplineDto } from './dto/update-discipline.dto';
import { Discipline } from './entities/discipline.entity';

type DisciplineRow = {
  id: string;
  name: string;
  event_id?: string | null;
  category?: string | null;
  gender?: string | null;
  parent_id?: string | null;
  scheduled_at?: string | null;
  venue_name?: string | null;
};

@Injectable()
export class DisciplinesService {
  private readonly logger = new Logger(DisciplinesService.name);

  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    @InjectRepository(Discipline)
    private readonly disciplineRepository: Repository<Discipline>,
  ) {}

  // ── Sincronización con el calendario deportivo ──────────────────────────────
  // Cada PRUEBA (disciplina hija con fecha programada) se refleja como un
  // evento en core.sports_calendar_events, enlazado por
  // external_id = "prueba:<id>": crearla crea el evento, editarla lo actualiza
  // y eliminarla (o quitarle la fecha) lo borra. Best-effort: un fallo aquí
  // nunca rompe la operación sobre la prueba.

  private calendarExternalId(disciplineId: string): string {
    return `prueba:${disciplineId}`;
  }

  private async syncCalendarEvent(row: DisciplineRow) {
    try {
      // Sólo las pruebas con fecha van al calendario; una disciplina raíz o
      // una prueba sin fecha retira su evento (si existía).
      if (!row.parent_id || !row.scheduled_at) {
        await this.removeCalendarEvent(row.id);
        return;
      }
      let parentName: string | null = null;
      if (row.parent_id) {
        const { data: parent } = await this.supabase
          .schema('core')
          .from('disciplines')
          .select('name')
          .eq('id', row.parent_id)
          .maybeSingle();
        parentName = (parent?.name as string | undefined) ?? null;
      }
      const externalId = this.calendarExternalId(row.id);
      const calendarRow = {
        event_id: row.event_id ?? null,
        sport: parentName || 'Prueba',
        league: 'Pruebas',
        home_team: null,
        away_team: null,
        venue: row.venue_name ?? null,
        start_at_utc: row.scheduled_at,
        status: 'SCHEDULED',
        external_id: externalId,
        source: 'PRUEBAS',
        metadata: {
          title: `🏁 ${row.name}`,
          scheduleType: 'COMPETITION',
          disciplineId: row.id,
          parentDisciplineId: row.parent_id ?? null,
          category: row.category ?? null,
          gender: row.gender ?? null,
        },
      };
      const { data: existing } = await this.supabase
        .schema('core')
        .from('sports_calendar_events')
        .select('id')
        .eq('external_id', externalId)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await this.supabase
          .schema('core')
          .from('sports_calendar_events')
          .update(calendarRow)
          .eq('id', existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await this.supabase
          .schema('core')
          .from('sports_calendar_events')
          .insert(calendarRow);
        if (error) throw new Error(error.message);
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo sincronizar la prueba ${row.id} con el calendario deportivo: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  private async removeCalendarEvent(disciplineId: string) {
    try {
      const { error } = await this.supabase
        .schema('core')
        .from('sports_calendar_events')
        .delete()
        .eq('external_id', this.calendarExternalId(disciplineId));
      if (error) throw new Error(error.message);
    } catch (err) {
      this.logger.warn(
        `No se pudo eliminar del calendario deportivo la prueba ${disciplineId}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  private normalizeGender(value?: string | null) {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    if (!normalized) return null;
    if (normalized === 'M' || normalized === 'MASCULINO' || normalized === 'HOMBRES') {
      return 'MALE';
    }
    if (normalized === 'F' || normalized === 'FEMENINO' || normalized === 'MUJERES') {
      return 'FEMALE';
    }
    return normalized;
  }

  private normalizeCategory(value?: string | null) {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    if (!normalized) return null;
    if (normalized === 'CONVENCIONAL') return 'CONVENTIONAL';
    if (normalized === 'PARALIMPICA' || normalized === 'PARALÍMPICA') {
      return 'PARALYMPIC';
    }
    return normalized;
  }

  private toRow(dto: CreateDisciplineDto | UpdateDisciplineDto) {
    const row: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      row.name = dto.name;
    }
    if (dto.eventId !== undefined) {
      row.event_id = dto.eventId;
    }
    if (dto.category !== undefined) {
      row.category = this.normalizeCategory(dto.category);
    }
    if (dto.gender !== undefined) {
      row.gender = this.normalizeGender(dto.gender);
    }
    if (dto.parentId !== undefined) {
      row.parent_id = dto.parentId || null;
    }
    if (dto.scheduledAt !== undefined) {
      row.scheduled_at = dto.scheduledAt || null;
    }
    if (dto.venueName !== undefined) {
      row.venue_name = dto.venueName || null;
    }
    return row;
  }

  private toEntity(row: DisciplineRow): Discipline {
    return {
      id: row.id,
      name: row.name,
      eventId: row.event_id ?? null,
      category: this.normalizeCategory(row.category),
      gender: this.normalizeGender(row.gender),
      parentId: row.parent_id ?? null,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : null,
      venueName: row.venue_name ?? null,
    };
  }

  async create(createDisciplineDto: CreateDisciplineDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('disciplines')
      .insert(this.toRow(createDisciplineDto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating discipline',
      );
    }

    // Las pruebas con fecha aparecen como eventos del calendario deportivo.
    await this.syncCalendarEvent(data as DisciplineRow);
    return this.toEntity(data as DisciplineRow);
  }

  async findAll() {
    try {
      return await this.disciplineRepository.find({
        order: { name: 'ASC' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching disciplines',
      );
    }
  }

  async findOne(id: string) {
    let data: Discipline | null;
    try {
      data = await this.disciplineRepository.findOne({ where: { id } });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching discipline',
      );
    }

    if (!data) {
      throw new NotFoundException(`Discipline with id ${id} not found`);
    }

    return data;
  }

  async update(id: string, updateDisciplineDto: UpdateDisciplineDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('disciplines')
      .update(this.toRow(updateDisciplineDto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating discipline',
      );
    }

    if (!data) {
      throw new NotFoundException(`Discipline with id ${id} not found`);
    }

    // Mantiene el evento del calendario deportivo al día (fecha/sede/nombre).
    await this.syncCalendarEvent(data as DisciplineRow);
    return this.toEntity(data as DisciplineRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('disciplines')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting discipline',
      );
    }

    if (!data) {
      throw new NotFoundException(`Discipline with id ${id} not found`);
    }

    // Retira también su evento del calendario deportivo.
    await this.removeCalendarEvent(id);
    return this.toEntity(data as DisciplineRow);
  }
}
