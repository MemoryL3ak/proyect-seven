import { Module } from '@nestjs/common';
import { SupabaseProvider } from '@/supabase/provider';
import { PremiacionesController } from './premiaciones.controller';
import { PremiacionesService } from './premiaciones.service';

@Module({
  controllers: [PremiacionesController],
  providers: [PremiacionesService, SupabaseProvider],
})
export class PremiacionesModule {}
