import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupabaseProvider } from '@/supabase/provider';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { Provider } from './entities/provider.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Provider])],
  controllers: [ProvidersController],
  providers: [ProvidersService, SupabaseProvider],
})
export class ProvidersModule {}
