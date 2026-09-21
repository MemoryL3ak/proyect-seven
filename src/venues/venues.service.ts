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
      // SEDE de competencia o COMEDOR; por defecto, sede.
      venueType: createVenueDto.venueType?.trim().toUpperCase() || 'SEDE',
      region: createVenueDto.region ?? null,
      commune: createVenueDto.commune ?? null,
      photoUrl: createVenueDto.photoUrl ?? null,
      // Deportes de la sede: se declaran acá, no se deducen de las pruebas.
      disciplineIds: createVenueDto.disciplineIds ?? [],
      coordinatorId: createVenueDto.coordinatorId || null,
      coordinatorName: createVenueDto.coordinatorName?.trim() || null,
      coordinatorPhone: createVenueDto.coordinatorPhone?.trim() || null,
    });
    await this.copiarFichaCoordinador(venue, createVenueDto.coordinatorId);
    return this.venuesRepository.save(venue);
  }

  /**
   * Copia nombre y teléfono del participante elegido a la sede. La sede se lee
   * en el portal, en la tarjeta de recinto y en los listados; sin esta copia,
   * cada uno tendría que ir a buscar la persona por su lado.
   */
  private async copiarFichaCoordinador(
    venue: Venue,
    coordinatorId?: string | null,
  ): Promise<void> {
    if (coordinatorId === undefined) return;
    if (!coordinatorId) {
      venue.coordinatorId = null;
      venue.coordinatorName = null;
      venue.coordinatorPhone = null;
      return;
    }
    const { data } = await this.supabase
      .schema('core')
      .from('athletes')
      .select('full_name, phone')
      .eq('id', coordinatorId)
      .maybeSingle();
    const ficha = data as { full_name?: string; phone?: string } | null;
    venue.coordinatorId = coordinatorId;
    if (ficha?.full_name) venue.coordinatorName = ficha.full_name;
    if (ficha?.phone) venue.coordinatorPhone = ficha.phone;
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
      ...(updateVenueDto.venueType !== undefined
        ? { venueType: updateVenueDto.venueType?.trim().toUpperCase() || 'SEDE' }
        : {}),
      ...(updateVenueDto.region !== undefined ? { region: updateVenueDto.region ?? null } : {}),
      ...(updateVenueDto.commune !== undefined ? { commune: updateVenueDto.commune ?? null } : {}),
      ...(updateVenueDto.photoUrl !== undefined ? { photoUrl: updateVenueDto.photoUrl ?? null } : {}),
      ...(updateVenueDto.disciplineIds !== undefined
        ? { disciplineIds: updateVenueDto.disciplineIds ?? [] }
        : {}),
      ...(updateVenueDto.coordinatorId !== undefined
        ? { coordinatorId: updateVenueDto.coordinatorId || null }
        : {}),
      ...(updateVenueDto.coordinatorName !== undefined
        ? { coordinatorName: updateVenueDto.coordinatorName?.trim() || null }
        : {}),
      ...(updateVenueDto.coordinatorPhone !== undefined
        ? { coordinatorPhone: updateVenueDto.coordinatorPhone?.trim() || null }
        : {}),
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
