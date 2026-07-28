import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { PremiacionesController } from './premiaciones.controller';
import { PremiacionesService } from './premiaciones.service';

@Module({
  imports: [PushNotificationsModule],
  controllers: [PremiacionesController],
  providers: [PremiacionesService, SupabaseProvider],
})
export class PremiacionesModule {}
