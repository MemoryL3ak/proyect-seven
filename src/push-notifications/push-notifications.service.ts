import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { RegisterTokenDto } from './dto/register-token.dto';
import { NotificationsService } from '../notifications/notifications.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type PushAudience = {
  userKind: string;
  userId: string;
};

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Tipo lógico del evento — se persiste en core.notifications.kind. */
  kind?: string;
  /** Emoji opcional para la campanita. */
  emoji?: string;
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
    private readonly notifications: NotificationsService,
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

  /**
   * Lista los destinatarios con al menos un token registrado, enriquecidos
   * con el nombre del atleta/conductor para el panel de envío manual.
   */
  async listRecipients() {
    const { data: tokens, error } = await this.supabase
      .schema('core')
      .from('device_tokens')
      .select('user_kind, user_id, platform, last_active_at')
      .order('last_active_at', { ascending: false });
    if (error) {
      this.logger.error(`listRecipients failed: ${error.message}`);
      return [];
    }

    type Entry = {
      userKind: string;
      userId: string;
      platforms: Set<string>;
      lastActiveAt: string;
    };
    const byUser = new Map<string, Entry>();
    for (const t of tokens ?? []) {
      const key = `${t.user_kind}:${t.user_id}`;
      const existing = byUser.get(key);
      if (!existing) {
        byUser.set(key, {
          userKind: t.user_kind,
          userId: t.user_id,
          platforms: new Set([t.platform]),
          lastActiveAt: t.last_active_at,
        });
      } else {
        existing.platforms.add(t.platform);
      }
    }

    const entries = Array.from(byUser.values());
    const athleteIds = entries
      .filter((e) => e.userKind === 'athlete')
      .map((e) => e.userId);
    const driverIds = entries
      .filter((e) => e.userKind === 'driver')
      .map((e) => e.userId);

    const names = new Map<string, string>();

    if (athleteIds.length > 0) {
      const { data } = await this.supabase
        .schema('core')
        .from('athletes')
        .select('id, full_name')
        .in('id', athleteIds);
      for (const a of (data ?? []) as { id: string; full_name: string }[]) {
        names.set(`athlete:${a.id}`, a.full_name);
      }
    }
    if (driverIds.length > 0) {
      const { data } = await this.supabase
        .schema('transport')
        .from('drivers')
        .select('id, full_name')
        .in('id', driverIds);
      for (const d of (data ?? []) as { id: string; full_name: string }[]) {
        names.set(`driver:${d.id}`, d.full_name);
      }
    }

    return entries.map((e) => ({
      userKind: e.userKind,
      userId: e.userId,
      fullName: names.get(`${e.userKind}:${e.userId}`) ?? null,
      platforms: Array.from(e.platforms),
      lastActiveAt: e.lastActiveAt,
    }));
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
   * Manda un push a todos los dispositivos del audience y persiste la
   * notificación en core.notifications para que aparezca en la campanita
   * dentro del portal. No throwea si Expo rechaza algún token — se loguea
   * y se sigue.
   */
  async send(audience: PushAudience, payload: PushPayload): Promise<void> {
    // Persistir primero en el inbox para que la campanita la muestre incluso
    // si la entrega vía Expo falla o el usuario no tiene tokens registrados.
    await this.notifications.insert(audience, {
      title: payload.title,
      body: payload.body,
      emoji: payload.emoji ?? null,
      kind: payload.kind ?? null,
      data: payload.data ?? {},
    });

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
