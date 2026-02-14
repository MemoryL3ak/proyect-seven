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
    return row;
  }

  private toEntity(row: DisciplineRow): Discipline {
    return {
      id: row.id,
      name: row.name,
      eventId: row.event_id ?? null,
      category: this.normalizeCategory(row.category),
      gender: this.normalizeGender(row.gender),
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
