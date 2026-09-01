import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ApiCaller } from '../auth/api-auth.guard';

/**
 * SA-BACKEND-04 · 2 — Bloqueo de chat de viaje persistido en base de datos
 * (tabla core.chat_blocks), asociado a usuario y viaje. Reemplaza el registro
 * en localStorage: el bloqueo acompaña al usuario en cualquier dispositivo.
 *
 * La identidad del que bloquea se deriva SIEMPRE del llamador autenticado
 * (guard global), nunca del cuerpo de la petición.
 */
@Injectable()
export class ChatBlocksService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  private identity(caller: ApiCaller) {
    if (caller.type === 'staff') {
      return { user_kind: 'staff', user_id: caller.userId };
    }
    return { user_kind: caller.kind, user_id: caller.userId };
  }

  private assertTripId(tripId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(String(tripId || ''))) {
      throw new BadRequestException('tripId inválido');
    }
  }

  async isBlocked(caller: ApiCaller, tripId: string): Promise<boolean> {
    this.assertTripId(tripId);
    const who = this.identity(caller);
    const { data, error } = await this.supabase
      .schema('core')
      .from('chat_blocks')
      .select('id')
      .eq('user_kind', who.user_kind)
      .eq('user_id', who.user_id)
      .eq('trip_id', tripId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return Boolean(data);
  }

  async block(caller: ApiCaller, tripId: string): Promise<void> {
    this.assertTripId(tripId);
    const who = this.identity(caller);
    const { error } = await this.supabase
      .schema('core')
      .from('chat_blocks')
      .upsert(
        { ...who, trip_id: tripId },
        { onConflict: 'user_kind,user_id,trip_id', ignoreDuplicates: true },
      );
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async unblock(caller: ApiCaller, tripId: string): Promise<void> {
    this.assertTripId(tripId);
    const who = this.identity(caller);
    const { error } = await this.supabase
      .schema('core')
      .from('chat_blocks')
      .delete()
      .eq('user_kind', who.user_kind)
      .eq('user_id', who.user_id)
      .eq('trip_id', tripId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
