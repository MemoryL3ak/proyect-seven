import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

export const SupabaseClient = (configService: ConfigService) => {
  const supabaseUrl = configService.get('SUPABASE_URL');
  const supabaseKey = configService.get('SUPABASE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
  }

  return createClient(supabaseUrl, supabaseKey);
};
