import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import * as https from 'https';
import { ConfigService } from '@nestjs/config';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { Driver } from './entities/driver.entity';

type DriverRow = {
  id: string;
  event_id: string;
  full_name: string;
  rut: string;
  email: string | null;
  provider_id: string | null;
  user_id: string | null;
  license_number: string | null;
  phone: string | null;
  vehicle_id: string | null;
  photo_url: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type VehicleRow = {
  id: string;
};

@Injectable()
export class DriversService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {}

  private getAdminClient() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !serviceRoleKey) {
      return null;
    }

    return createClient(supabaseUrl, serviceRoleKey);
  }

  private toRow(dto: CreateDriverDto | UpdateDriverDto) {
    const row: Record<string, unknown> = {};

    if (dto.eventId !== undefined) {
      row.event_id = dto.eventId;
    }
    if (dto.fullName !== undefined) {
      row.full_name = dto.fullName;
    }
    if (dto.rut !== undefined) {
      row.rut = dto.rut;
    }
    if (dto.email !== undefined) {
      row.email = dto.email ?? null;
    }
    if (dto.providerId !== undefined) {
      row.provider_id = dto.providerId ?? null;
    }
    if (dto.userId !== undefined) {
      row.user_id = dto.userId ?? null;
    }
    if (dto.licenseNumber !== undefined) {
      row.license_number = dto.licenseNumber ?? null;
    }
    if (dto.phone !== undefined) {
      row.phone = dto.phone ?? null;
    }
    if (dto.vehicleId !== undefined) {
      row.vehicle_id = dto.vehicleId ?? null;
    }
    if (dto.photoUrl !== undefined) {
      row.photo_url = dto.photoUrl ?? null;
    }
    if (dto.status !== undefined) {
      row.status = dto.status;
    }
    if (dto.metadata !== undefined) {
      row.metadata = dto.metadata ?? {};
    }

    return row;
  }

  private toEntity(row: DriverRow): Driver {
    return {
      id: row.id,
      eventId: row.event_id,
      fullName: row.full_name,
      rut: row.rut,
      email: row.email,
      providerId: row.provider_id,
      userId: row.user_id,
      licenseNumber: row.license_number,
      phone: row.phone,
      vehicleId: row.vehicle_id,
      photoUrl: row.photo_url,
      status: row.status,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async createVehicleIfNeeded(
    dto: CreateDriverDto | UpdateDriverDto,
    fallbackEventId?: string,
  ) {
    if (dto.vehicleId) return dto.vehicleId;
    if (!dto.vehiclePlate && !dto.vehicleType && dto.vehicleCapacity === undefined) {
      return undefined;
    }

    const eventId = dto.eventId ?? fallbackEventId;
    if (!eventId) {
      throw new InternalServerErrorException(
        'eventId is required to create vehicle',
      );
    }
    if (!dto.vehiclePlate || !dto.vehicleType) {
      throw new InternalServerErrorException(
        'vehiclePlate and vehicleType are required to create vehicle',
      );
    }

    const payload = {
      event_id: eventId,
      plate: dto.vehiclePlate,
      type: dto.vehicleType,
      brand: dto.vehicleBrand ?? null,
      model: dto.vehicleModel ?? null,
      capacity: dto.vehicleCapacity ?? 0,
      status: dto.vehicleStatus ?? 'AVAILABLE',
    };

    const { data, error } = await this.supabase
      .schema('transport')
      .from('vehicles')
      .insert(payload)
      .select('id')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating vehicle',
      );
    }

    return (data as VehicleRow).id;
  }

  private async updateVehicleIfProvided(
    vehicleId: string,
    dto: UpdateDriverDto,
  ) {
    const hasUpdates =
      dto.vehiclePlate !== undefined ||
      dto.vehicleType !== undefined ||
      dto.vehicleBrand !== undefined ||
      dto.vehicleModel !== undefined ||
      dto.vehicleCapacity !== undefined ||
      dto.vehicleStatus !== undefined;

    if (!hasUpdates) return;

    const updatePayload: Record<string, unknown> = {};
    if (dto.vehiclePlate !== undefined) updatePayload.plate = dto.vehiclePlate;
    if (dto.vehicleType !== undefined) updatePayload.type = dto.vehicleType;
    if (dto.vehicleBrand !== undefined) updatePayload.brand = dto.vehicleBrand;
    if (dto.vehicleModel !== undefined) updatePayload.model = dto.vehicleModel;
    if (dto.vehicleCapacity !== undefined)
      updatePayload.capacity = dto.vehicleCapacity;
    if (dto.vehicleStatus !== undefined)
      updatePayload.status = dto.vehicleStatus;

    const { error } = await this.supabase
      .schema('transport')
      .from('vehicles')
      .update(updatePayload)
      .eq('id', vehicleId);

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating vehicle',
      );
    }
  }

  async create(createDriverDto: CreateDriverDto) {
    let userId = createDriverDto.userId ?? null;
    const vehicleId = await this.createVehicleIfNeeded(createDriverDto);

    if (!userId && createDriverDto.email) {
      const admin = this.getAdminClient();
      if (!admin) {
        throw new InternalServerErrorException(
          'SUPABASE_SERVICE_ROLE_KEY is required to create auth users',
        );
      }

      const { data, error } = await admin.auth.admin.inviteUserByEmail(
        createDriverDto.email,
      );

      if (error || !data?.user) {
        throw new InternalServerErrorException(
          error?.message || 'Error creating driver auth user',
        );
      }

      userId = data.user.id;
    }

    const payload: CreateDriverDto = {
      ...createDriverDto,
      userId: userId ?? undefined,
      vehicleId,
    };

    const { data, error } = await this.supabase
      .schema('transport')
      .from('drivers')
      .insert(this.toRow(payload))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating driver',
      );
    }

    return this.toEntity(data as DriverRow);
  }

  async findAll() {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching drivers',
      );
    }

    return (data ?? []).map((row) => this.toEntity(row as DriverRow));
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('drivers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching driver',
      );
    }

    if (!data) {
      throw new NotFoundException(`Driver with id ${id} not found`);
    }

    return this.toEntity(data as DriverRow);
  }

  async update(id: string, updateDriverDto: UpdateDriverDto) {
    let userId = updateDriverDto.userId ?? undefined;
    let vehicleId = updateDriverDto.vehicleId ?? undefined;

    if (userId === undefined && updateDriverDto.email) {
      const { data: current, error: currentError } = await this.supabase
        .schema('transport')
        .from('drivers')
        .select('user_id')
        .eq('id', id)
        .maybeSingle();

      if (currentError) {
        throw new InternalServerErrorException(
          currentError.message || 'Error fetching driver',
        );
      }

      if (!current) {
        throw new NotFoundException(`Driver with id ${id} not found`);
      }

      if (!current.user_id) {
        const admin = this.getAdminClient();
        if (!admin) {
          throw new InternalServerErrorException(
            'SUPABASE_SERVICE_ROLE_KEY is required to create auth users',
          );
        }

        let resolvedUserId: string | null = null;
        const adminAny = admin.auth.admin as unknown as {
          getUserByEmail?: (email: string) => Promise<{
            data?: { user?: { id: string } };
            error?: { message?: string };
          }>;
          inviteUserByEmail: (email: string) => Promise<{
            data?: { user?: { id: string } };
            error?: { message?: string };
          }>;
        };

        if (adminAny.getUserByEmail) {
          const { data, error } = await adminAny.getUserByEmail(
            updateDriverDto.email,
          );
          if (error) {
            throw new InternalServerErrorException(
              error.message || 'Error fetching auth user',
            );
          }
          resolvedUserId = data?.user?.id ?? null;
        }

        if (!resolvedUserId) {
          const { data, error } = await adminAny.inviteUserByEmail(
            updateDriverDto.email,
          );
          if (error) {
            throw new InternalServerErrorException(
              error.message || 'Error creating driver auth user',
            );
          }
          resolvedUserId = data?.user?.id ?? null;
        }

        userId = resolvedUserId ?? undefined;
      }
    }

    let currentEventId: string | undefined;
    if (vehicleId === undefined) {
      const { data: current, error: currentError } = await this.supabase
        .schema('transport')
        .from('drivers')
        .select('vehicle_id, event_id')
        .eq('id', id)
        .maybeSingle();

      if (currentError) {
        throw new InternalServerErrorException(
          currentError.message || 'Error fetching driver vehicle',
        );
      }

      vehicleId = current?.vehicle_id ?? undefined;
      currentEventId = current?.event_id ?? undefined;
    }

    if (!vehicleId) {
      vehicleId = await this.createVehicleIfNeeded(
        updateDriverDto,
        currentEventId,
      );
    } else {
      await this.updateVehicleIfProvided(vehicleId, updateDriverDto);
    }

    const { data, error } = await this.supabase
      .schema('transport')
      .from('drivers')
      .update(this.toRow({ ...updateDriverDto, userId, vehicleId }))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating driver',
      );
    }

    if (!data) {
      throw new NotFoundException(`Driver with id ${id} not found`);
    }

    return this.toEntity(data as DriverRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('drivers')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting driver',
      );
    }

    if (!data) {
      throw new NotFoundException(`Driver with id ${id} not found`);
    }

    return this.toEntity(data as DriverRow);
  }

  async uploadPhoto(id: string, dataUrl: string) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new BadRequestException('Invalid photo payload');
    }

    const contentType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    const extension = contentType.split('/')[1] || 'jpg';
    const path = `${id}/${Date.now()}.${extension}`;

    const admin = this.getAdminClient();
    if (!admin) {
      throw new InternalServerErrorException(
        'SUPABASE_SERVICE_ROLE_KEY is required to upload driver photos',
      );
    }

    const { error } = await admin.storage
      .from('driver-photos')
      .upload(path, buffer, { contentType, upsert: true });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error uploading driver photo',
      );
    }

    const { data } = admin.storage
      .from('driver-photos')
      .getPublicUrl(path);

    const publicUrl = data?.publicUrl ?? null;
    if (!publicUrl) {
      throw new InternalServerErrorException(
        'Error resolving driver photo URL',
      );
    }

    return this.update(id, { photoUrl: publicUrl });
  }

  async requestAccess(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await this.supabase
      .schema('transport')
      .from('drivers')
      .select('id, full_name, email')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching driver',
      );
    }

    if (!data) {
      throw new BadRequestException(
        'El correo no corresponde a un conductor registrado',
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;

    if (!apiKey || !from) {
      throw new InternalServerErrorException('Email provider not configured');
    }

    const fullName = data.full_name ?? 'Conductor';
    const subject = 'Tu código de acceso';
    const text = `Hola ${fullName},\n\nTu ID de conductor para ingresar al portal es:\n${data.id}\n\nGuárdalo en un lugar seguro.\n`;
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tu codigo de acceso</title>
  </head>
  <body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 12px 30px rgba(15,23,42,0.08);overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#94a3b8;">Seven</div>
                <h1 style="margin:8px 0 0 0;font-size:22px;font-weight:600;color:#0f172a;">Tu codigo de acceso</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 32px 24px 32px;">
                <p style="margin:0;font-size:14px;color:#475569;">Hola ${fullName},</p>
                <p style="margin:14px 0 0 0;font-size:14px;color:#475569;">
                  Tu ID de conductor para ingresar al portal es:
                </p>
                <div style="margin:16px 0;padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;font-size:16px;letter-spacing:0.02em;color:#0f172a;">
                  ${data.id}
                </div>
                <p style="margin:0;font-size:13px;color:#64748b;">
                  Guardalo en un lugar seguro.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;">
                <div style="height:1px;background:#e2e8f0;"></div>
                <p style="margin:14px 0 0 0;font-size:11px;color:#94a3b8;">
                  Si no solicitaste este codigo, ignora este mensaje.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const payload = JSON.stringify({
      from,
      to: [normalizedEmail],
      subject,
      text,
      html,
    });

    const { status, body } = await new Promise<{
      status: number;
      body: string;
    }>((resolve, reject) => {
      const request = https.request(
        {
          method: 'POST',
          hostname: 'api.resend.com',
          path: '/emails',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (response) => {
          let dataBuffer = '';
          response.on('data', (chunk) => {
            dataBuffer += chunk;
          });
          response.on('end', () => {
            resolve({ status: response.statusCode ?? 0, body: dataBuffer });
          });
        },
      );

      request.on('error', (err) => reject(err));
      request.write(payload);
      request.end();
    });

    if (status < 200 || status >= 300) {
      throw new InternalServerErrorException(
        `No se pudo enviar el correo: ${body}`,
      );
    }

    return { message: 'Código enviado al correo' };
  }
}
