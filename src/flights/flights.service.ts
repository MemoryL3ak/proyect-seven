import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SupabaseClient } from '@supabase/supabase-js';
import { Repository } from 'typeorm';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { Flight } from './entities/flight.entity';

type FlightRow = {
  id: string;
  event_id: string;
  flight_number: string;
  airline: string;
  arrival_time: string;
  origin: string;
  terminal: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class FlightsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    @InjectRepository(Flight)
    private readonly flightRepository: Repository<Flight>,
  ) {}

  private async fetchAviationStack(
    flightNumber: string,
    flightDate?: string,
  ): Promise<Record<string, unknown>[]> {
    const apiKey = process.env.AVIATIONSTACK_API_KEY;
    if (!apiKey)
      throw new InternalServerErrorException('Missing AVIATIONSTACK_API_KEY configuration');

    const normalized = (flightNumber ?? '').replace(/\s+/g, '').toUpperCase();
    if (!normalized)
      throw new InternalServerErrorException('Flight number is required');

    const url = new URL('https://api.aviationstack.com/v1/flights');
    url.searchParams.set('access_key', apiKey);
    if (/^[A-Z]{2,3}\d+$/.test(normalized)) {
      url.searchParams.set('flight_iata', normalized);
    } else {
      const digits = normalized.replace(/\D/g, '');
      if (!digits)
        throw new InternalServerErrorException('Invalid flight number format');
      url.searchParams.set('flight_number', digits);
    }
    if (flightDate) {
      url.searchParams.set('flight_date', flightDate);
    }

    const response = await fetch(url.toString());
    if (!response.ok)
      throw new InternalServerErrorException(
        `AviationStack request failed (${response.status})`,
      );

    const payload = (await response.json()) as {
      data?: Record<string, unknown>[];
      error?: { message?: string };
    };
    if (payload.error)
      throw new InternalServerErrorException(
        payload.error.message || 'AviationStack error',
      );

    return payload.data ?? [];
  }

  async lookupAirline(flightNumber: string) {
    const data = await this.fetchAviationStack(flightNumber);
    const normalized = (flightNumber ?? '').replace(/\s+/g, '').toUpperCase();
    const first = data[0] as any;
    if (!first?.airline)
      throw new NotFoundException('Airline not found for flight number');

    const dep = first.departure ?? {};
    const arr = first.arrival ?? {};
    const originCity = dep.city ?? null;
    const originCountry = dep.country ?? null;
    const originDisplay =
      originCity && originCountry
        ? `${originCity}, ${originCountry}`
        : originCity || originCountry || dep.airport || null;

    return {
      flightNumber: first.flight?.iata || first.flight?.number || normalized,
      airlineName: first.airline.name ?? null,
      airlineIata: first.airline.iata ?? null,
      airlineIcao: first.airline.icao ?? null,
      origin: originDisplay,
      originCity,
      originCountry,
      departureGate: dep.gate ?? null,
      arrivalBaggage: arr.baggage ?? null,
    };
  }

  async trackFlight(flightNumber: string, flightDate?: string) {
    const data = await this.fetchAviationStack(flightNumber, flightDate);
    const normalized = (flightNumber ?? '').replace(/\s+/g, '').toUpperCase();
    if (!data.length)
      throw new NotFoundException(
        `No se encontró información para el vuelo ${normalized}. Verifica que el número de vuelo sea correcto (ej: LA180, AA900).`,
      );

    const nowMs = Date.now();
    const targetDate = flightDate || new Date().toISOString().slice(0, 10);
    const targetMs = new Date(targetDate).getTime();

    // Prioritize: 1) active/scheduled flights, 2) future flights, 3) closest to target date
    const sorted = [...data].sort((a: any, b: any) => {
      const statusA = a.flight_status ?? '';
      const statusB = b.flight_status ?? '';
      const isActiveA = ['active', 'scheduled'].includes(statusA);
      const isActiveB = ['active', 'scheduled'].includes(statusB);
      // Active/scheduled flights first
      if (isActiveA && !isActiveB) return -1;
      if (!isActiveA && isActiveB) return 1;
      // Then prefer future flights over past
      const dateA = new Date(a.flight_date || '').getTime();
      const dateB = new Date(b.flight_date || '').getTime();
      const isFutureA = dateA >= targetMs;
      const isFutureB = dateB >= targetMs;
      if (isFutureA && !isFutureB) return -1;
      if (!isFutureA && isFutureB) return 1;
      // Finally, closest to target date
      return Math.abs(dateA - targetMs) - Math.abs(dateB - targetMs);
    });
    const row = sorted[0] as any;
    const dep = row.departure ?? {};
    const arr = row.arrival ?? {};
    const live = row.live ?? null;

    return {
      flightNumber: row.flight?.iata || row.flight?.number || normalized,
      flightIcao: row.flight?.icao ?? null,
      airlineName: row.airline?.name ?? null,
      airlineIata: row.airline?.iata ?? null,
      flightStatus: row.flight_status ?? null,
      flightDate: row.flight_date ?? null,
      depAirport: dep.airport ?? null,
      depIata: dep.iata ?? null,
      depCity: dep.city ?? null,
      depCountry: dep.country ?? null,
      depScheduled: dep.scheduled ?? null,
      depEstimated: dep.estimated ?? null,
      depActual: dep.actual ?? null,
      depGate: dep.gate ?? null,
      depDelayMinutes: dep.delay ?? null,
      arrAirport: arr.airport ?? null,
      arrIata: arr.iata ?? null,
      arrCity: arr.city ?? null,
      arrCountry: arr.country ?? null,
      arrScheduled: arr.scheduled ?? null,
      arrEstimated: arr.estimated ?? null,
      arrActual: arr.actual ?? null,
      arrBaggage: arr.baggage ?? null,
      arrDelayMinutes: arr.delay ?? null,
      liveUpdated: live?.updated ?? null,
      liveLatitude: live?.latitude ?? null,
      liveLongitude: live?.longitude ?? null,
      liveAltitude: live?.altitude ?? null,
      liveDirection: live?.direction ?? null,
      liveSpeedHorizontal: live?.speed_horizontal ?? null,
      liveIsGround: live?.is_ground ?? null,
    };
  }

  private toRow(dto: CreateFlightDto | UpdateFlightDto) {
    const row: Record<string, unknown> = {};

    if (dto.eventId !== undefined) {
      row.event_id = dto.eventId;
    }
    if (dto.flightNumber !== undefined) {
      row.flight_number = dto.flightNumber;
    }
    if (dto.airline !== undefined) {
      row.airline = dto.airline;
    }
    if (dto.arrivalTime !== undefined) {
      row.arrival_time = dto.arrivalTime;
    }
    if (dto.origin !== undefined) {
      row.origin = dto.origin;
    }
    if (dto.terminal !== undefined) {
      row.terminal = dto.terminal ?? null;
    }

    return row;
  }

  private toEntity(row: FlightRow): Flight {
    return {
      id: row.id,
      eventId: row.event_id,
      flightNumber: row.flight_number,
      airline: row.airline,
      arrivalTime: new Date(row.arrival_time),
      origin: row.origin,
      terminal: row.terminal,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(createFlightDto: CreateFlightDto) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('flights')
      .insert(this.toRow(createFlightDto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating flight',
      );
    }

    return this.toEntity(data as FlightRow);
  }

  async findAll() {
    try {
      return await this.flightRepository.find({
        order: { arrivalTime: 'ASC' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching flights',
      );
    }
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('flights')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching flight',
      );
    }

    if (!data) {
      throw new NotFoundException(`Flight with id ${id} not found`);
    }

    return this.toEntity(data as FlightRow);
  }

  async update(id: string, updateFlightDto: UpdateFlightDto) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('flights')
      .update(this.toRow(updateFlightDto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating flight',
      );
    }

    if (!data) {
      throw new NotFoundException(`Flight with id ${id} not found`);
    }

    return this.toEntity(data as FlightRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('flights')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting flight',
      );
    }

    if (!data) {
      throw new NotFoundException(`Flight with id ${id} not found`);
    }

    return this.toEntity(data as FlightRow);
  }
}
