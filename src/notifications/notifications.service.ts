import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

export type NotificationAudience = {
  userKind: string;
  userId: string;
};

export type NotificationContent = {
  title: string;
  body: string;
  emoji?: string | null;
  kind?: string | null;
  data?: Record<string, unknown>;
};

export type NotificationRow = {
  id: string;
  user_kind: string;
  user_id: string;
  title: string;
  body: string;
  emoji: string | null;
  kind: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Inserta una notificación en la bandeja del usuario. Devuelve la row
   * creada. No lanza si falla — devuelve null y loguea, para no romper el
   * envío de push (que es el camino crítico al usuario).
   */
  async insert(
    audience: NotificationAudience,
    content: NotificationContent,
  ): Promise<NotificationRow | null> {
    const row = {
      user_kind: audience.userKind,
      user_id: audience.userId,
      title: content.title,
      body: content.body,
      emoji: content.emoji ?? null,
      kind: content.kind ?? null,
      data: content.data ?? {},
    };
    const { data, error } = await this.supabase
      .schema('core')
      .from('notifications')
      .insert(row)
      .select('*')
      .single();
    if (error) {
      // No-throw: el push debe seguir aunque la BD falle.
      return null;
    }
    return data as NotificationRow;
  }

  async list(audience: NotificationAudience, limit = 50) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('notifications')
      .select('*')
      .eq('user_kind', audience.userKind)
      .eq('user_id', audience.userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as NotificationRow[];
  }

  async markRead(
    audience: NotificationAudience,
    ids?: string[],
  ): Promise<{ updated: number }> {
    let query = this.supabase
      .schema('core')
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_kind', audience.userKind)
      .eq('user_id', audience.userId)
      .is('read_at', null);
    if (ids && ids.length > 0) {
      query = query.in('id', ids);
    }
    const { data, error } = await query.select('id');
    if (error) throw new InternalServerErrorException(error.message);
    return { updated: (data ?? []).length };
  }

  async clear(audience: NotificationAudience): Promise<{ deleted: number }> {
    const { data, error } = await this.supabase
      .schema('core')
      .from('notifications')
      .delete()
      .eq('user_kind', audience.userKind)
      .eq('user_id', audience.userId)
      .select('id');
    if (error) throw new InternalServerErrorException(error.message);
    return { deleted: (data ?? []).length };
  }
}
