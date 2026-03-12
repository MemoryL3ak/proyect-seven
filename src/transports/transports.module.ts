import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransportsService } from './transports.service';
import { TransportsController } from './transports.controller';
import { SupabaseProvider } from '@/supabase/provider';
import { Transport } from './entities/transport.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transport])],
  controllers: [TransportsController],
  providers: [TransportsService, SupabaseProvider],
})
export class TransportsModule {}
