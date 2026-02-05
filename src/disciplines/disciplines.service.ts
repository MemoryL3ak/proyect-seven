import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { UpdateDisciplineDto } from './dto/update-discipline.dto';
import { Discipline } from './entities/discipline.entity';

type DisciplineRow = {
  id: string;
  name: string;
  event_id?: string | null;
  category?: string | null;
  gender?: string | null;
};

@Injectable()
export class DisciplinesService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  private toRow(dto: CreateDisciplineDto | UpdateDisciplineDto) {
    const row: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      row.name = dto.name;
    }
    if (dto.eventId !== undefined) {
      row.event_id = dto.eventId;
    }
    if (dto.category !== undefined) {
      row.category = dto.category;
    }
    if (dto.gender !== undefined) {
      row.gender = dto.gender;
    }
    return row;
  }

  private toEntity(row: DisciplineRow): Discipline {
    return {
      id: row.id,
      name: row.name,
      eventId: row.event_id ?? null,
      category: row.category ?? null,
      gender: row.gender ?? null,
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

    return this.toEntity(data as DisciplineRow);
  }

  async findAll() {
    const { data, error } = await this.supabase
      .schema('core')
      .from('disciplines')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching disciplines',
      );
    }

    return (data ?? []).map((row) => this.toEntity(row as DisciplineRow));
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('disciplines')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching discipline',
      );
    }

    if (!data) {
      throw new NotFoundException(`Discipline with id ${id} not found`);
    }

    return this.toEntity(data as DisciplineRow);
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

    return this.toEntity(data as DisciplineRow);
  }
}
