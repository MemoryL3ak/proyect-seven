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

export type MobileRecoverResult = {
  status: 'ok';
  message: string;
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

  async recover(input: { email: string }): Promise<MobileRecoverResult> {
    const email = String(input.email || '').trim().toLowerCase();

    const genericMessage =
      'Si tu correo está registrado, te enviaremos tu código de acceso en breve.';

    const athlete = await this.findAthleteByEmail(email);
    if (athlete) {
      const code = String(athlete.id).slice(-6).toLowerCase();
      this.logger.log(
        `Recover requested by athlete ${athlete.id} (${email}) — code ${code}`,
      );
      return { status: 'ok', message: genericMessage };
    }

    const driver = await this.findDriverByEmail(email);
    if (driver) {
      const code = String(driver.id).slice(-6).toLowerCase();
      this.logger.log(
        `Recover requested by driver ${driver.id} (${email}) — code ${code}`,
      );
      return { status: 'ok', message: genericMessage };
    }

    this.logger.log(`Recover request from unknown email ${email}`);
    return { status: 'ok', message: genericMessage };
  }

  private async findAthleteByEmail(
    email: string,
  ): Promise<{ id: string; full_name: string; email: string | null } | null> {
    if (!email) return null;
    const { data, error } = await this.supabase
      .schema('core')
      .from('athletes')
      .select('id, full_name, email')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.error('Athlete email lookup error', JSON.stringify(error));
      return null;
    }
    return data ?? null;
  }

  private async findDriverByEmail(
    email: string,
  ): Promise<{ id: string; full_name: string; email: string | null } | null> {
    if (!email) return null;
    const { data: driver, error: driverError } = await this.supabase
      .schema('transport')
      .from('drivers')
      .select('id, full_name, email')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();

    if (driverError) {
      this.logger.error('Driver email lookup error', JSON.stringify(driverError));
    }
    if (driver) return driver;

    const { data: participant, error: participantError } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .select('id, full_name, email, metadata')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();

    if (participantError) {
      this.logger.error(
        'Participant email lookup error',
        JSON.stringify(participantError),
      );
      return null;
    }
    if (!participant) return null;

    const meta = (participant.metadata ?? {}) as Record<string, unknown>;
    if (meta.isDriver === true || meta.isDriver === 'true') {
      return {
        id: participant.id,
        full_name: participant.full_name,
        email: participant.email ?? null,
      };
    }
    return null;
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
