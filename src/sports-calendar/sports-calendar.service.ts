import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateSportsCalendarEventDto } from './dto/create-sports-calendar-event.dto';
import { QuerySportsCalendarEventsDto } from './dto/query-sports-calendar-events.dto';
import { UpdateSportsCalendarEventDto } from './dto/update-sports-calendar-event.dto';
import { SportsCalendarEvent } from './entities/sports-calendar-event.entity';

type SportsCalendarEventRow = {
  id: string;
  event_id: string | null;
  sport: string;
  league: string;
  season: string | null;
  home_team: string | null;
  away_team: string | null;
  venue: string | null;
  start_at_utc: string;
  status: string;
  score_home: number | null;
  score_away: number | null;
  external_id: string | null;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class SportsCalendarService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  private toRow(
    dto: CreateSportsCalendarEventDto | UpdateSportsCalendarEventDto,
  ) {
    const row: Record<string, unknown> = {};

    if (dto.eventId !== undefined) row.event_id = dto.eventId ?? null;
    if (dto.sport !== undefined) row.sport = dto.sport;
    if (dto.league !== undefined) row.league = dto.league;
    if (dto.season !== undefined) row.season = dto.season ?? null;
    if (dto.homeTeam !== undefined || dto.competitorA !== undefined) {
      row.home_team = dto.homeTeam ?? dto.competitorA ?? null;
    }
    if (dto.awayTeam !== undefined || dto.competitorB !== undefined) {
      row.away_team = dto.awayTeam ?? dto.competitorB ?? null;
    }
    if (dto.venue !== undefined) row.venue = dto.venue ?? null;
    if (dto.startAtUtc !== undefined) row.start_at_utc = dto.startAtUtc;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.scoreHome !== undefined) row.score_home = dto.scoreHome;
    if (dto.scoreAway !== undefined) row.score_away = dto.scoreAway;
    if (dto.externalId !== undefined) row.external_id = dto.externalId ?? null;
    if (dto.source !== undefined) row.source = dto.source ?? null;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;

    return row;
  }

  private toEntity(row: SportsCalendarEventRow): SportsCalendarEvent {
    return {
      id: row.id,
      eventId: row.event_id,
      sport: row.sport,
      league: row.league,
      season: row.season,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      venue: row.venue,
      startAtUtc: new Date(row.start_at_utc),
      status: row.status,
      scoreHome: row.score_home,
      scoreAway: row.score_away,
      externalId: row.external_id,
      source: row.source,
      metadata: row.metadata ?? {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(dto: CreateSportsCalendarEventDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('sports_calendar_events')
      .insert(this.toRow(dto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating sports calendar event',
      );
    }

    return this.toEntity(data as SportsCalendarEventRow);
  }

  async createBulk(dtos: CreateSportsCalendarEventDto[]) {
    const payload = dtos.map((dto) => this.toRow(dto));
    const { data, error } = await this.supabase
      .schema('core')
      .from('sports_calendar_events')
      .insert(payload)
      .select('*');

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error creating sports calendar events',
      );
    }

    return {
      inserted: (data ?? []).length,
      events: (data ?? []).map((row) =>
        this.toEntity(row as SportsCalendarEventRow),
      ),
    };
  }

  async findAll(filters: QuerySportsCalendarEventsDto) {
    let query = this.supabase
      .schema('core')
      .from('sports_calendar_events')
      .select('*');

    if (filters.from) query = query.gte('start_at_utc', filters.from);
    if (filters.to) query = query.lte('start_at_utc', filters.to);
    if (filters.eventId) query = query.eq('event_id', filters.eventId);
    if (filters.sport) query = query.eq('sport', filters.sport);
    if (filters.league) query = query.eq('league', filters.league);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.source) query = query.eq('source', filters.source);
    if (filters.team) {
      const teamLike = `%${filters.team}%`;
      query = query.or(`home_team.ilike.${teamLike},away_team.ilike.${teamLike}`);
    }

    const { data, error } = await query.order('start_at_utc', {
      ascending: true,
    });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching sports calendar events',
      );
    }

    return (data ?? []).map((row) =>
      this.toEntity(row as SportsCalendarEventRow),
    );
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('sports_calendar_events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching sports calendar event',
      );
    }

    if (!data) {
      throw new NotFoundException(`Sports calendar event with id ${id} not found`);
    }

    return this.toEntity(data as SportsCalendarEventRow);
  }

  async update(id: string, dto: UpdateSportsCalendarEventDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('sports_calendar_events')
      .update(this.toRow(dto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating sports calendar event',
      );
    }

    if (!data) {
      throw new NotFoundException(`Sports calendar event with id ${id} not found`);
    }

    return this.toEntity(data as SportsCalendarEventRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('sports_calendar_events')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting sports calendar event',
      );
    }

    if (!data) {
      throw new NotFoundException(`Sports calendar event with id ${id} not found`);
    }

    return this.toEntity(data as SportsCalendarEventRow);
  }
}
