import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Session, SupabaseClient, User } from '@supabase/supabase-js';

export type MobileLoginResult =
  | {
      kind: 'admin';
      user: User;
      session: Session;
      requiresPasswordChange: boolean;
    }
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

  async login(input: { email: string; secret: string }): Promise<MobileLoginResult> {
    const email = String(input.email || '').trim().toLowerCase();
    const secret = String(input.secret || '').trim();

    if (!email || !secret) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const adminResult = await this.tryAdminLogin(email, secret);
    if (adminResult) return adminResult;

    const athleteResult = await this.tryAthleteLogin(email, secret);
    if (athleteResult) return athleteResult;

    const driverResult = await this.tryDriverLogin(email, secret);
    if (driverResult) return driverResult;

    throw new UnauthorizedException('Credenciales inválidas');
  }

  private async tryAdminLogin(
    email: string,
    password: string,
  ): Promise<Extract<MobileLoginResult, { kind: 'admin' }> | null> {
    if (password.length < 8) return null;

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session) {
      return null;
    }

    const metadata = (data.user.user_metadata || {}) as Record<string, unknown>;
    const requiresPasswordChange = Boolean(
      metadata.forcePasswordChange ?? metadata.force_password_change,
    );

    return {
      kind: 'admin',
      user: data.user,
      session: data.session,
      requiresPasswordChange,
    };
  }

  private async tryAthleteLogin(
    email: string,
    secret: string,
  ): Promise<Extract<MobileLoginResult, { kind: 'athlete' }> | null> {
    const { data, error } = await this.supabase
      .schema('core')
      .from('athletes')
      .select('id, full_name, email')
      .ilike('email', email)
      .maybeSingle();

    if (error) {
      this.logger.error('Athlete lookup error', JSON.stringify(error));
      return null;
    }
    if (!data) return null;

    const expectedCode = String(data.id).slice(-6).toLowerCase();
    if (secret.toLowerCase() !== expectedCode) return null;

    return {
      kind: 'athlete',
      athleteId: data.id,
      profile: {
        id: data.id,
        fullName: data.full_name,
        email: data.email ?? null,
      },
    };
  }

  private async tryDriverLogin(
    email: string,
    secret: string,
  ): Promise<Extract<MobileLoginResult, { kind: 'driver' }> | null> {
    const { data: driverData, error: driverError } = await this.supabase
      .schema('transport')
      .from('drivers')
      .select('id, full_name, email')
      .ilike('email', email)
      .maybeSingle();

    if (driverError) {
      this.logger.error('Driver lookup error', JSON.stringify(driverError));
    }

    if (driverData) {
      const expectedCode = String(driverData.id).slice(-6).toLowerCase();
      if (secret.toLowerCase() === expectedCode) {
        return {
          kind: 'driver',
          driverId: driverData.id,
          profile: {
            id: driverData.id,
            fullName: driverData.full_name,
            email: driverData.email ?? null,
          },
        };
      }
    }

    const { data: participantData, error: participantError } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .select('id, full_name, email, metadata')
      .ilike('email', email)
      .maybeSingle();

    if (participantError) {
      this.logger.error(
        'Participant lookup error',
        JSON.stringify(participantError),
      );
      return null;
    }
    if (!participantData) return null;

    const meta = (participantData.metadata ?? {}) as Record<string, unknown>;
    const isDriver = meta.isDriver === true || meta.isDriver === 'true';
    if (!isDriver) return null;

    const expectedCode = String(participantData.id).slice(-6).toLowerCase();
    if (secret.toLowerCase() !== expectedCode) return null;

    return {
      kind: 'driver',
      driverId: participantData.id,
      profile: {
        id: participantData.id,
        fullName: participantData.full_name,
        email: participantData.email ?? null,
      },
    };
  }
}
