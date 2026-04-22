import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AwarderInputDto, CreatePremiacionDto } from './dto/create-premiacion.dto';
import { UpdatePremiacionDto } from './dto/update-premiacion.dto';

type PremiacionRow = any;
type AwarderRow = any;

@Injectable()
export class PremiacionesService {
  constructor(@Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient) {}

  private toRow(dto: CreatePremiacionDto | UpdatePremiacionDto) {
    const row: Record<string, unknown> = {};
    if (dto.eventId !== undefined) row.event_id = dto.eventId ?? null;
    if (dto.sportsEventId !== undefined) row.sports_event_id = dto.sportsEventId ?? null;
    if (dto.disciplineId !== undefined) row.discipline_id = dto.disciplineId ?? null;
    if (dto.title !== undefined) row.title = dto.title;
    if (dto.discipline !== undefined) row.discipline = dto.discipline ?? null;
    if (dto.scheduledAt !== undefined) row.scheduled_at = dto.scheduledAt;
    if (dto.venueId !== undefined) row.venue_id = dto.venueId ?? null;
    if (dto.venueName !== undefined) row.venue_name = dto.venueName ?? null;
    if (dto.locationDetail !== undefined) row.location_detail = dto.locationDetail ?? null;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.notes !== undefined) row.notes = dto.notes ?? null;
    return row;
  }

  private async syncAwarders(premiacionId: string, awarders: AwarderInputDto[]) {
    // Replace strategy: delete all + insert new (simple for MVP)
    const { error: delError } = await this.supabase
      .schema('core')
      .from('premiacion_awarders')
      .delete()
      .eq('premiacion_id', premiacionId);
    if (delError) throw new InternalServerErrorException(delError.message);

    if (!awarders.length) return;
    const rows = awarders.map((a) => ({
      premiacion_id: premiacionId,
      athlete_id: a.athleteId,
      role: a.role ?? 'AWARDER',
      notes: a.notes ?? null,
    }));
    const { error: insError } = await this.supabase
      .schema('core')
      .from('premiacion_awarders')
      .insert(rows);
    if (insError) throw new InternalServerErrorException(insError.message);
  }

  async create(dto: CreatePremiacionDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('premiaciones')
      .insert(this.toRow(dto))
      .select('*')
      .single();
    if (error || !data) {
      throw new InternalServerErrorException(error?.message || 'Error creating premiacion');
    }
    if (dto.awarders?.length) {
      await this.syncAwarders(data.id, dto.awarders);
    }
    return this.findOne(data.id);
  }

  async findAll(filter?: { athleteId?: string; from?: string; to?: string }) {
    let query = this.supabase
      .schema('core')
      .from('premiaciones')
      .select('*')
      .order('scheduled_at', { ascending: true });

    if (filter?.from) query = query.gte('scheduled_at', filter.from);
    if (filter?.to) query = query.lte('scheduled_at', filter.to);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);

    const premiaciones = data ?? [];
    if (premiaciones.length === 0) return [];

    const ids = premiaciones.map((p: PremiacionRow) => p.id);
    const { data: awardersData, error: awardersError } = await this.supabase
      .schema('core')
      .from('premiacion_awarders')
      .select('*')
      .in('premiacion_id', ids);
    if (awardersError) throw new InternalServerErrorException(awardersError.message);

    const byPremiacion = new Map<string, AwarderRow[]>();
    (awardersData ?? []).forEach((a: AwarderRow) => {
      const arr = byPremiacion.get(a.premiacion_id) ?? [];
      arr.push(a);
      byPremiacion.set(a.premiacion_id, arr);
    });

    let result = premiaciones.map((p: PremiacionRow) => ({
      ...p,
      awarders: byPremiacion.get(p.id) ?? [],
    }));

    if (filter?.athleteId) {
      result = result.filter((p: any) =>
        p.awarders.some((a: AwarderRow) => a.athlete_id === filter.athleteId),
      );
    }

    return result;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('premiaciones')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Premiación ${id} no encontrada`);

    const { data: awardersData, error: awardersError } = await this.supabase
      .schema('core')
      .from('premiacion_awarders')
      .select('*')
      .eq('premiacion_id', id);
    if (awardersError) throw new InternalServerErrorException(awardersError.message);

    return { ...data, awarders: awardersData ?? [] };
  }

  async update(id: string, dto: UpdatePremiacionDto) {
    const row = this.toRow(dto);
    row.updated_at = new Date().toISOString();
    const { data, error } = await this.supabase
      .schema('core')
      .from('premiaciones')
      .update(row)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Premiación ${id} no encontrada`);

    if (dto.awarders !== undefined) {
      await this.syncAwarders(id, dto.awarders);
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('premiaciones')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Premiación ${id} no encontrada`);
    return { message: 'Eliminada' };
  }

  async confirmAwarder(
    premiacionId: string,
    awarderId: string,
    decision: 'CONFIRM' | 'DECLINE',
  ) {
    const update: Record<string, unknown> = {};
    if (decision === 'CONFIRM') {
      update.confirmed_at = new Date().toISOString();
      update.declined_at = null;
    } else {
      update.declined_at = new Date().toISOString();
      update.confirmed_at = null;
    }
    const { data, error } = await this.supabase
      .schema('core')
      .from('premiacion_awarders')
      .update(update)
      .eq('id', awarderId)
      .eq('premiacion_id', premiacionId)
      .select('*')
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Asignación no encontrada');
    return data;
  }

  async findByDiscipline(disciplineId: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('premiaciones')
      .select('*')
      .eq('discipline_id', disciplineId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) return null;

    const { data: awardersData, error: awardersError } = await this.supabase
      .schema('core')
      .from('premiacion_awarders')
      .select('*')
      .eq('premiacion_id', data.id);
    if (awardersError) throw new InternalServerErrorException(awardersError.message);

    return { ...data, awarders: awardersData ?? [] };
  }

  async findBySportsEvent(sportsEventId: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('premiaciones')
      .select('*')
      .eq('sports_event_id', sportsEventId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) return null;

    const { data: awardersData, error: awardersError } = await this.supabase
      .schema('core')
      .from('premiacion_awarders')
      .select('*')
      .eq('premiacion_id', data.id);
    if (awardersError) throw new InternalServerErrorException(awardersError.message);

    return { ...data, awarders: awardersData ?? [] };
  }

  async findByAthlete(athleteId: string) {
    if (!athleteId) throw new BadRequestException('athleteId requerido');
    const { data, error } = await this.supabase
      .schema('core')
      .from('premiacion_awarders')
      .select('*')
      .eq('athlete_id', athleteId);
    if (error) throw new InternalServerErrorException(error.message);

    const assignments = data ?? [];
    if (assignments.length === 0) return [];

    const premiacionIds = Array.from(
      new Set(assignments.map((a: AwarderRow) => a.premiacion_id)),
    );
    const { data: premiacionesData, error: premiacionesError } = await this.supabase
      .schema('core')
      .from('premiaciones')
      .select('*')
      .in('id', premiacionIds)
      .order('scheduled_at', { ascending: true });
    if (premiacionesError) {
      throw new InternalServerErrorException(premiacionesError.message);
    }

    const byPremiacion = new Map<string, AwarderRow>();
    assignments.forEach((a: AwarderRow) => byPremiacion.set(a.premiacion_id, a));

    return (premiacionesData ?? []).map((p: PremiacionRow) => ({
      ...p,
      myAssignment: byPremiacion.get(p.id),
    }));
  }
}
