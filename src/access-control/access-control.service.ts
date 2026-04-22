import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import * as https from 'https';
import { accessCodeEmailHtml } from '../shared/email-templates';
import { ScanDto } from './dto/scan.dto';

type TargetMatch = {
  targetType: 'athlete' | 'driver' | 'provider_participant';
  targetId: string;
  targetName: string;
  authorized: boolean;
  reason: string;
  extra?: Record<string, unknown>;
};

@Injectable()
export class AccessControlService {
  constructor(@Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient) {}

  private async findMatch(code: string): Promise<TargetMatch | null> {
    const normalized = code.trim().toLowerCase();
    if (normalized.length < 4) return null;

    // Athletes
    const { data: athletes, error: athletesError } = await this.supabase
      .schema('core')
      .from('athletes')
      .select('id, full_name, accreditation_status, status, delegation_id');
    if (athletesError) {
      throw new InternalServerErrorException(athletesError.message);
    }
    const athleteHit = (athletes || []).find(
      (row: any) => String(row.id).slice(-6).toLowerCase() === normalized,
    );
    if (athleteHit) {
      const accreditationOk =
        !athleteHit.accreditation_status ||
        ['APPROVED', 'ISSUED'].includes(String(athleteHit.accreditation_status).toUpperCase());
      const statusOk = !athleteHit.status || String(athleteHit.status).toUpperCase() !== 'DISABLED';
      return {
        targetType: 'athlete',
        targetId: athleteHit.id,
        targetName: athleteHit.full_name,
        authorized: accreditationOk && statusOk,
        reason: accreditationOk && statusOk ? 'OK' : 'CREDENTIAL_INVALID',
        extra: { delegationId: athleteHit.delegation_id },
      };
    }

    // Drivers
    const { data: drivers, error: driversError } = await this.supabase
      .schema('transport')
      .from('drivers')
      .select('id, full_name, accreditation_status, status');
    if (driversError) {
      throw new InternalServerErrorException(driversError.message);
    }
    const driverHit = (drivers || []).find(
      (row: any) => String(row.id).slice(-6).toLowerCase() === normalized,
    );
    if (driverHit) {
      const accreditationOk =
        !driverHit.accreditation_status ||
        ['APPROVED', 'ISSUED'].includes(String(driverHit.accreditation_status).toUpperCase());
      const statusOk = !driverHit.status || String(driverHit.status).toUpperCase() !== 'DISABLED';
      return {
        targetType: 'driver',
        targetId: driverHit.id,
        targetName: driverHit.full_name,
        authorized: accreditationOk && statusOk,
        reason: accreditationOk && statusOk ? 'OK' : 'CREDENTIAL_INVALID',
      };
    }

    // Provider participants
    const { data: participants, error: participantsError } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .select('id, full_name, status, provider_id');
    if (participantsError) {
      throw new InternalServerErrorException(participantsError.message);
    }
    const participantHit = (participants || []).find(
      (row: any) => String(row.id).slice(-6).toLowerCase() === normalized,
    );
    if (participantHit) {
      const statusOk =
        !participantHit.status ||
        String(participantHit.status).toUpperCase() !== 'DISABLED';
      return {
        targetType: 'provider_participant',
        targetId: participantHit.id,
        targetName: participantHit.full_name,
        authorized: statusOk,
        reason: statusOk ? 'OK' : 'CREDENTIAL_INVALID',
        extra: { providerId: participantHit.provider_id },
      };
    }

    return null;
  }

  async scan(dto: ScanDto) {
    const match = await this.findMatch(dto.code);

    const row = {
      scanned_by_id: dto.scannedById,
      scanned_by_name: dto.scannedByName ?? null,
      target_type: match?.targetType ?? 'unknown',
      target_id: match?.targetId ?? null,
      target_name: match?.targetName ?? null,
      target_code: dto.code.trim(),
      location: dto.location ?? null,
      authorized: match?.authorized ?? false,
      reason: match?.reason ?? 'NOT_FOUND',
      metadata: match?.extra ?? {},
      scanned_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .schema('core')
      .from('access_scans')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      scan: data,
      authorized: row.authorized,
      reason: row.reason,
      target: match
        ? {
            type: match.targetType,
            id: match.targetId,
            name: match.targetName,
            ...match.extra,
          }
        : null,
    };
  }

  async requestAccess(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('El correo es obligatorio');
    }

    // Find provider_participant by email
    const { data: participant, error: participantError } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .select('id, full_name, email, provider_id, status')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (participantError) {
      throw new InternalServerErrorException(
        participantError.message || 'Error buscando participante',
      );
    }

    if (!participant) {
      throw new BadRequestException(
        'El correo no corresponde a un staff registrado',
      );
    }

    if (String(participant.status ?? '').toUpperCase() === 'DISABLED') {
      throw new BadRequestException('El usuario está deshabilitado');
    }

    // Verify provider is of type "Staff"
    const { data: provider, error: providerError } = await this.supabase
      .schema('core')
      .from('providers')
      .select('id, name, type')
      .eq('id', participant.provider_id)
      .maybeSingle();

    if (providerError) {
      throw new InternalServerErrorException(
        providerError.message || 'Error buscando proveedor',
      );
    }

    if (!provider || String(provider.type ?? '').toLowerCase() !== 'staff') {
      throw new BadRequestException(
        'El correo no corresponde a un staff registrado',
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) {
      throw new InternalServerErrorException('Email provider not configured');
    }

    const fullName = participant.full_name ?? 'Staff';
    const accessCode = participant.id.slice(-6);
    const subject = 'Tu código de acceso — Control de Acceso';
    const text = `Hola ${fullName},\n\nTu código de acceso para ingresar al portal de Control de Acceso es:\n${accessCode}\n\nGuárdalo en un lugar seguro.\n`;
    const html = accessCodeEmailHtml(fullName, accessCode);

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

  async listRecent(limit = 50) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('access_scans')
      .select('*')
      .order('scanned_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data ?? [];
  }
}
