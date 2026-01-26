import { SupabaseClient } from './client';
import { ConfigService } from '@nestjs/config';

export const SupabaseProvider = {
  provide: 'SUPABASE_CLIENT',
  useFactory: SupabaseClient,
  inject: [ConfigService],
};
