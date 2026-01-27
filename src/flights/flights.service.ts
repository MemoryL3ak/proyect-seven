import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
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
  ) {}

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
      .schema('logistics')
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
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('flights')
      .select('*')
      .order('arrival_time', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching flights',
      );
    }

    return (data ?? []).map((row) => this.toEntity(row as FlightRow));
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('logistics')
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
      .schema('logistics')
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
      .schema('logistics')
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
