import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

export type MobileLoginResult =
  | {
      kind: 'athlete';
      athleteId: string;
      profile: {
        id: string;
        fullName: string;
        email: string | null;
      };
    }
  | {
      kind: 'driver';
      driverId: string;
      profile: {
        id: string;
        fullName: string;
        email: string | null;
      };
    };

@Injectable()
export class MobileAuthService {
  constructor(
    private readonly logger: Logger = new Logger(MobileAuthService.name),
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  async login(input: { code: string }): Promise<MobileLoginResult> {
    const code = String(input.code || '').trim().toLowerCase();

    if (!code || code.length < 6) {
      throw new UnauthorizedException('Código inválido');
    }

    const athleteResult = await this.tryAthleteByCode(code);
    if (athleteResult) return athleteResult;

    const driverResult = await this.tryDriverByCode(code);
    if (driverResult) return driverResult;

    throw new UnauthorizedException('Código inválido');
  }

  private async tryAthleteByCode(
    code: string,
  ): Promise<Extract<MobileLoginResult, { kind: 'athlete' }> | null> {
    const { data, error } = await this.supabase
      .schema('core')
      .from('athletes')
      .select('id, full_name, email');

    if (error) {
      this.logger.error('Athlete lookup error', JSON.stringify(error));
      return null;
    }

    const matches = (data ?? []).filter(
      (row) => String(row.id).slice(-6).toLowerCase() === code,
    );

    if (matches.length === 0) return null;
    if (matches.length > 1) {
      this.logger.warn(
        `Code collision in athletes for ${code} (${matches.length} matches)`,
      );
      return null;
    }

    const match = matches[0];
    return {
      kind: 'athlete',
      athleteId: match.id,
      profile: {
        id: match.id,
        fullName: match.full_name,
        email: match.email ?? null,
      },
    };
  }

  private async tryDriverByCode(
    code: string,
  ): Promise<Extract<MobileLoginResult, { kind: 'driver' }> | null> {
    // 1. transport.drivers
    const { data: driverData, error: driverError } = await this.supabase
      .schema('transport')
      .from('drivers')
      .select('id, full_name, email');

    if (driverError) {
      this.logger.error('Driver lookup error', JSON.stringify(driverError));
    }

    const driverMatches = (driverData ?? []).filter(
      (row) => String(row.id).slice(-6).toLowerCase() === code,
    );

    if (driverMatches.length > 1) {
      this.logger.warn(
        `Code collision in drivers for ${code} (${driverMatches.length} matches)`,
      );
      return null;
    }

    if (driverMatches.length === 1) {
      const match = driverMatches[0];
      return {
        kind: 'driver',
        driverId: match.id,
        profile: {
          id: match.id,
          fullName: match.full_name,
          email: match.email ?? null,
        },
      };
    }

    // 2. core.provider_participants flagged as driver
    const { data: participantData, error: participantError } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .select('id, full_name, email, metadata');

    if (participantError) {
      this.logger.error(
        'Participant lookup error',
        JSON.stringify(participantError),
      );
      return null;
    }

    const participantMatches = (participantData ?? []).filter((row) => {
      if (String(row.id).slice(-6).toLowerCase() !== code) return false;
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      return meta.isDriver === true || meta.isDriver === 'true';
    });

    if (participantMatches.length === 0) return null;
    if (participantMatches.length > 1) {
      this.logger.warn(
        `Code collision in provider_participants for ${code} (${participantMatches.length} matches)`,
      );
      return null;
    }

    const match = participantMatches[0];
    return {
      kind: 'driver',
      driverId: match.id,
      profile: {
        id: match.id,
        fullName: match.full_name,
        email: match.email ?? null,
      },
    };
  }
}
