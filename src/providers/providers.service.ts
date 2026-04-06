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
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { Provider } from './entities/provider.entity';

type ProviderRow = {
  id: string;
  name: string;
  type: string | null;
  subtype: string | null;
  email: string | null;
  phone: string | null;
  rut: string | null;
  address: string | null;
  city: string | null;
  contact_name: string | null;
  bid_amount: number | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class ProvidersService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  private getAdminClient() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return null;
    return createClient(supabaseUrl, serviceRoleKey);
  }

  private toRow(dto: CreateProviderDto | UpdateProviderDto) {
    const row: Record<string, unknown> = {};

    if (dto.name !== undefined) row.name = dto.name;
    if (dto.type !== undefined) row.type = dto.type ?? null;
    if (dto.subtype !== undefined) row.subtype = dto.subtype ?? null;
    if (dto.email !== undefined) row.email = dto.email ?? null;
    if (dto.phone !== undefined) row.phone = dto.phone ?? null;
    if (dto.rut !== undefined) row.rut = dto.rut ?? null;
    if (dto.address !== undefined) row.address = dto.address ?? null;
    if (dto.city !== undefined) row.city = dto.city ?? null;
    if (dto.contactName !== undefined) row.contact_name = dto.contactName ?? null;
    if (dto.bidAmount !== undefined) row.bid_amount = dto.bidAmount ?? null;
    if (dto.status !== undefined) row.status = dto.status ?? null;
    if (dto.metadata !== undefined) row.metadata = dto.metadata ?? {};

    return row;
  }

  private toEntity(row: ProviderRow): Provider {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      subtype: row.subtype,
      email: row.email,
      phone: row.phone,
      rut: row.rut,
      address: row.address,
      city: row.city,
      contactName: row.contact_name,
      bidAmount: row.bid_amount != null ? Number(row.bid_amount) : null,
      status: row.status,
      metadata: row.metadata ?? {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(createProviderDto: CreateProviderDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('providers')
      .insert(this.toRow(createProviderDto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating provider',
      );
    }

    return this.toEntity(data as ProviderRow);
  }

  async findAll() {
    try {
      return await this.providerRepository.find({
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching providers',
      );
    }
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('providers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching provider',
      );
    }

    if (!data) {
      throw new NotFoundException(`Provider with id ${id} not found`);
    }

    return this.toEntity(data as ProviderRow);
  }

  async update(id: string, updateProviderDto: UpdateProviderDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('providers')
      .update(this.toRow(updateProviderDto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating provider',
      );
    }

    if (!data) {
      throw new NotFoundException(`Provider with id ${id} not found`);
    }

    return this.toEntity(data as ProviderRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('providers')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      // FK violation: provider has linked drivers
      if ((error as { code?: string }).code === '23503') {
        throw new BadRequestException(
          'No se puede eliminar el proveedor porque tiene conductores asociados. Elimina o reasigna los conductores primero.',
        );
      }
      throw new InternalServerErrorException(
        error.message || 'Error deleting provider',
      );
    }

    if (!data) {
      throw new NotFoundException(`Provider with id ${id} not found`);
    }

    return this.toEntity(data as ProviderRow);
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
        'SUPABASE_SERVICE_ROLE_KEY is required to upload provider documents',
      );
    }

    const { error } = await admin.storage
      .from('provider-documents')
      .upload(path, buffer, { contentType, upsert: true });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error uploading provider document',
      );
    }

    const { data } = admin.storage.from('provider-documents').getPublicUrl(path);
    const publicUrl = data?.publicUrl ?? null;
    if (!publicUrl) {
      throw new InternalServerErrorException('Error resolving provider document URL');
    }

    const provider = await this.findOne(id);
    const metadata = { ...(provider.metadata ?? {}), [key]: publicUrl };

    return this.update(id, { metadata });
  }
}
