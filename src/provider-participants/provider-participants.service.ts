import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { CreateProviderParticipantDto } from './dto/create-provider-participant.dto';
import { UpdateProviderParticipantDto } from './dto/update-provider-participant.dto';
import { ProviderParticipant } from './entities/provider-participant.entity';

type ParticipantRow = {
  id: string;
  provider_id: string;
  full_name: string;
  rut: string | null;
  country_code: string | null;
  passport_number: string | null;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  user_type: string | null;
  visa_required: boolean | null;
  trip_type: string | null;
  flight_number: string | null;
  airline: string | null;
  origin: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  observations: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class ProviderParticipantsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
    @InjectRepository(ProviderParticipant)
    private readonly repo: Repository<ProviderParticipant>,
  ) {}

  private getAdminClient() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!supabaseUrl || !serviceRoleKey) return null;
    return createClient(supabaseUrl, serviceRoleKey);
  }

  private toRow(
    dto: CreateProviderParticipantDto | UpdateProviderParticipantDto,
  ) {
    const row: Record<string, unknown> = {};
    if (dto.providerId !== undefined) row.provider_id = dto.providerId;
    if (dto.fullName !== undefined) row.full_name = dto.fullName;
    if (dto.rut !== undefined) row.rut = dto.rut ?? null;
    if (dto.countryCode !== undefined) row.country_code = dto.countryCode ?? null;
    if (dto.passportNumber !== undefined) row.passport_number = dto.passportNumber ?? null;
    if (dto.dateOfBirth !== undefined) row.date_of_birth = dto.dateOfBirth ?? null;
    if (dto.email !== undefined) row.email = dto.email ?? null;
    if (dto.phone !== undefined) row.phone = dto.phone ?? null;
    if (dto.userType !== undefined) row.user_type = dto.userType ?? null;
    if (dto.visaRequired !== undefined) row.visa_required = dto.visaRequired ?? null;
    if (dto.tripType !== undefined) row.trip_type = dto.tripType ?? null;
    if (dto.flightNumber !== undefined) row.flight_number = dto.flightNumber ?? null;
    if (dto.airline !== undefined) row.airline = dto.airline ?? null;
    if (dto.origin !== undefined) row.origin = dto.origin ?? null;
    if (dto.arrivalTime !== undefined) row.arrival_time = dto.arrivalTime ?? null;
    if (dto.departureTime !== undefined) row.departure_time = dto.departureTime ?? null;
    if (dto.observations !== undefined) row.observations = dto.observations ?? null;
    if (dto.metadata !== undefined) row.metadata = dto.metadata ?? {};
    return row;
  }

  private toEntity(row: ParticipantRow): ProviderParticipant {
    return {
      id: row.id,
      providerId: row.provider_id,
      fullName: row.full_name,
      rut: row.rut,
      countryCode: row.country_code,
      passportNumber: row.passport_number,
      dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth) : null,
      email: row.email,
      phone: row.phone,
      userType: row.user_type,
      visaRequired: row.visa_required,
      tripType: row.trip_type,
      flightNumber: row.flight_number,
      airline: row.airline,
      origin: row.origin,
      arrivalTime: row.arrival_time ? new Date(row.arrival_time) : null,
      departureTime: row.departure_time ? new Date(row.departure_time) : null,
      observations: row.observations,
      status: row.status,
      metadata: row.metadata ?? {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(dto: CreateProviderParticipantDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .insert(this.toRow(dto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating participant',
      );
    }

    return this.toEntity(data as ParticipantRow);
  }

  async findAll(providerId?: string) {
    try {
      const qb = this.repo.createQueryBuilder('p').orderBy('p.fullName', 'ASC');
      if (providerId) qb.where('p.providerId = :providerId', { providerId });
      return await qb.getMany();
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching participants',
      );
    }
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching participant',
      );
    }
    if (!data) throw new NotFoundException(`Participant ${id} not found`);

    return this.toEntity(data as ParticipantRow);
  }

  async update(id: string, dto: UpdateProviderParticipantDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .update(this.toRow(dto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating participant',
      );
    }
    if (!data) throw new NotFoundException(`Participant ${id} not found`);

    return this.toEntity(data as ParticipantRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting participant',
      );
    }
    if (!data) throw new NotFoundException(`Participant ${id} not found`);

    return this.toEntity(data as ParticipantRow);
  }

  async uploadDocument(id: string, key: string, dataUrl: string) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new BadRequestException('Invalid document payload');

    const contentType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    const extension = contentType.split('/')[1]?.split('+')[0] || 'bin';
    const path = `${id}/${key}-${Date.now()}.${extension}`;

    const admin = this.getAdminClient();
    if (!admin) {
      throw new InternalServerErrorException(
        'SUPABASE_SERVICE_ROLE_KEY is required to upload documents',
      );
    }

    const { error } = await admin.storage
      .from('provider-documents')
      .upload(path, buffer, { contentType, upsert: true });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error uploading document',
      );
    }

    const { data } = admin.storage
      .from('provider-documents')
      .getPublicUrl(path);
    const publicUrl = data?.publicUrl ?? null;
    if (!publicUrl) {
      throw new InternalServerErrorException('Error resolving document URL');
    }

    const participant = await this.findOne(id);
    const metadata = { ...(participant.metadata ?? {}), [key]: publicUrl };

    return this.update(id, { metadata });
  }
}
