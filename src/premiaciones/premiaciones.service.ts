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

  /** Convierte una fila snake_case del DB a camelCase para el frontend. */
  private fromRow(row: PremiacionRow | null | undefined): any {
    if (!row) return row;
    const awarders = Array.isArray(row.awarders)
      ? row.awarders.map((a: AwarderRow) => this.fromAwarder(a))
      : undefined;
    return {
      id: row.id,
      eventId: row.event_id,
      sportsEventId: row.sports_event_id,
      title: row.title,
      discipline: row.discipline,
      disciplineId: row.discipline_id,
      scheduledAt: row.scheduled_at,
      venueId: row.venue_id,
      venueName: row.venue_name,
      locationDetail: row.location_detail,
      status: row.status,
      notes: row.notes,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(awarders !== undefined ? { awarders } : {}),
    };
  }

  private fromAwarder(a: AwarderRow): any {
    return {
      id: a.id,
      premiacionId: a.premiacion_id,
      athleteId: a.athlete_id,
      role: a.role,
      confirmedAt: a.confirmed_at,
      declinedAt: a.declined_at,
      notes: a.notes,
      metadata: a.metadata,
      createdAt: a.created_at,
    };
  }

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
    // Estrategia upsert: preserva las confirmaciones/rechazos de los
    // entregadores que siguen asignados. Sólo se eliminan los que salen y se
    // insertan los nuevos, sin tocar confirmed_at/declined_at de los que quedan.
    const { data: existingData, error: exError } = await this.supabase
      .schema('core')
      .from('premiacion_awarders')
      .select('*')
      .eq('premiacion_id', premiacionId);
    if (exError) throw new InternalServerErrorException(exError.message);

    const existing = (existingData ?? []) as AwarderRow[];
    const existingByAthlete = new Map<string, AwarderRow>();
    existing.forEach((a) => existingByAthlete.set(a.athlete_id, a));
    const desiredIds = new Set(awarders.map((a) => a.athleteId));

    // 1. Eliminar los entregadores que ya no están en la lista deseada.
    const toRemove = existing
      .filter((a) => !desiredIds.has(a.athlete_id))
      .map((a) => a.id);
    if (toRemove.length) {
      const { error } = await this.supabase
        .schema('core')
        .from('premiacion_awarders')
        .delete()
        .in('id', toRemove);
      if (error) throw new InternalServerErrorException(error.message);
    }

    // 2. Insertar los entregadores nuevos (sin confirmación previa).
    const toInsert = awarders
      .filter((a) => !existingByAthlete.has(a.athleteId))
      .map((a) => ({
        premiacion_id: premiacionId,
        athlete_id: a.athleteId,
        role: a.role ?? 'AWARDER',
        notes: a.notes ?? null,
      }));
    if (toInsert.length) {
      const { error } = await this.supabase
        .schema('core')
        .from('premiacion_awarders')
        .insert(toInsert);
      if (error) throw new InternalServerErrorException(error.message);
    }

    // 3. Actualizar rol/notas de los que permanecen (sin perder confirmación).
    for (const a of awarders) {
      const ex = existingByAthlete.get(a.athleteId);
      if (!ex) continue;
      const nextRole = a.role ?? 'AWARDER';
      const nextNotes = a.notes ?? null;
      if (ex.role !== nextRole || (ex.notes ?? null) !== nextNotes) {
        const { error } = await this.supabase
          .schema('core')
          .from('premiacion_awarders')
          .update({ role: nextRole, notes: nextNotes })
          .eq('id', ex.id);
        if (error) throw new InternalServerErrorException(error.message);
      }
    }
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

    return result.map((p) => this.fromRow(p));
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

    return this.fromRow({ ...data, awarders: awardersData ?? [] });
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
