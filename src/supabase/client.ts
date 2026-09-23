import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { fetchConReintento } from './fetch-con-reintento';

export const SupabaseClient = (configService: ConfigService) => {
  const supabaseUrl = configService.get<string>('SUPABASE_URL');
  const supabaseServiceRoleKey = configService.get<string>(
    'SUPABASE_SERVICE_ROLE_KEY',
  );
  const supabaseKey =
    supabaseServiceRoleKey || configService.get<string>('SUPABASE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY) must be set',
    );
  }

  // Las lecturas que se caen por red entre el API y Supabase se repiten un
  // par de veces antes de devolverle "fetch failed" al usuario.
  const fetchBase: typeof fetch | undefined =
    typeof globalThis.fetch === 'function'
      ? (input, init) => globalThis.fetch(input, init)
      : undefined;
  return createClient(
    supabaseUrl,
    supabaseKey,
    fetchBase ? { global: { fetch: fetchConReintento(fetchBase) } } : undefined,
  );
};
