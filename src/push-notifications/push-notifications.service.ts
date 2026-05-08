import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { RegisterTokenDto } from './dto/register-token.dto';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type PushAudience = {
  userKind: string;
  userId: string;
};

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'high';
  channelId?: string;
};

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  async register(dto: RegisterTokenDto) {
    const row = {
      user_kind: dto.userKind,
      user_id: dto.userId,
      platform: dto.platform,
      expo_token: dto.expoToken,
      app_version: dto.appVersion ?? null,
      device_name: dto.deviceName ?? null,
      last_active_at: new Date().toISOString(),
    };
    const { data, error } = await this.supabase
      .schema('core')
      .from('device_tokens')
      .upsert(row, { onConflict: 'expo_token' })
      .select('*')
      .single();
    if (error) {
      this.logger.error(`register token failed: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
    return data;
  }

  async unregister(expoToken: string) {
    const { error } = await this.supabase
      .schema('core')
      .from('device_tokens')
      .delete()
      .eq('expo_token', expoToken);
    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  async listTokens(audience: PushAudience): Promise<string[]> {
    const { data, error } = await this.supabase
      .schema('core')
      .from('device_tokens')
      .select('expo_token')
      .eq('user_kind', audience.userKind)
      .eq('user_id', audience.userId);
    if (error) {
      this.logger.error(`listTokens failed: ${error.message}`);
      return [];
    }
    return (data ?? []).map((r) => r.expo_token as string);
  }

  /**
   * Manda un push a todos los dispositivos del audience. No throwea si Expo
   * rechaza algún token — se loguea y se sigue.
   */
  async send(audience: PushAudience, payload: PushPayload): Promise<void> {
    const tokens = await this.listTokens(audience);
    if (tokens.length === 0) return;

    const messages: ExpoMessage[] = tokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: 'default',
      priority: 'high',
      channelId: 'default',
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Expo push HTTP ${res.status}: ${text}`);
        return;
      }
      const json = (await res.json()) as {
        data?: Array<{ status: string; message?: string; details?: { error?: string } }>;
      };
      const errors = (json.data ?? [])
        .map((d, i) => ({ d, token: tokens[i] }))
        .filter((x) => x.d.status !== 'ok');
      for (const err of errors) {
        this.logger.warn(
          `push token ${err.token} -> ${err.d.status} ${err.d.details?.error ?? ''} ${err.d.message ?? ''}`,
        );
        // DeviceNotRegistered = el token caducó o el usuario desinstaló.
        if (err.d.details?.error === 'DeviceNotRegistered') {
          await this.unregister(err.token).catch(() => {});
        }
      }
    } catch (err) {
      this.logger.error(
        `Expo push request failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
