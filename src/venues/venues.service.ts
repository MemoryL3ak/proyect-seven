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
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { Venue } from './entities/venue.entity';

@Injectable()
export class VenuesService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
    @InjectRepository(Venue)
    private readonly venuesRepository: Repository<Venue>,
  ) {}

  private getAdminClient() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return null;
    return createClient(supabaseUrl, serviceRoleKey);
  }

  async create(createVenueDto: CreateVenueDto) {
    const venue = this.venuesRepository.create({
      eventId: createVenueDto.eventId,
      name: createVenueDto.name,
      address: createVenueDto.address ?? null,
      region: createVenueDto.region ?? null,
      commune: createVenueDto.commune ?? null,
      photoUrl: createVenueDto.photoUrl ?? null,
    });
    return this.venuesRepository.save(venue);
  }

  async findAll() {
    return this.venuesRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const venue = await this.venuesRepository.findOne({ where: { id } });
    if (!venue) throw new NotFoundException(`Venue with id ${id} not found`);
    return venue;
  }

  async update(id: string, updateVenueDto: UpdateVenueDto) {
    const venue = await this.findOne(id);
    Object.assign(venue, {
      ...(updateVenueDto.eventId !== undefined ? { eventId: updateVenueDto.eventId } : {}),
      ...(updateVenueDto.name !== undefined ? { name: updateVenueDto.name } : {}),
      ...(updateVenueDto.address !== undefined ? { address: updateVenueDto.address ?? null } : {}),
      ...(updateVenueDto.region !== undefined ? { region: updateVenueDto.region ?? null } : {}),
      ...(updateVenueDto.commune !== undefined ? { commune: updateVenueDto.commune ?? null } : {}),
      ...(updateVenueDto.photoUrl !== undefined ? { photoUrl: updateVenueDto.photoUrl ?? null } : {}),
    });
    return this.venuesRepository.save(venue);
  }

  async remove(id: string) {
    const venue = await this.findOne(id);
    await this.venuesRepository.remove(venue);
    return venue;
  }

  async uploadPhoto(id: string, dataUrl: string) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new BadRequestException('Invalid photo payload');

    const contentType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    const extension = contentType.split('/')[1] || 'jpg';
    const path = `${id}/${Date.now()}.${extension}`;

    const admin = this.getAdminClient();
    if (!admin) {
      throw new InternalServerErrorException(
        'SUPABASE_SERVICE_ROLE_KEY is required to upload venue photos',
      );
    }

    const { error } = await admin.storage
      .from('venue-photos')
      .upload(path, buffer, { contentType, upsert: true });

    if (error) {
      throw new InternalServerErrorException(error.message || 'Error uploading venue photo');
    }

    const { data } = admin.storage.from('venue-photos').getPublicUrl(path);
    const publicUrl = data?.publicUrl ?? null;
    if (!publicUrl) {
      throw new InternalServerErrorException('Error resolving venue photo URL');
    }

    return this.update(id, { photoUrl: publicUrl });
  }
}
