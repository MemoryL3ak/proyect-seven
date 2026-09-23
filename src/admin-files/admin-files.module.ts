import { Module } from '@nestjs/common';
import { AdminFilesController } from './admin-files.controller';
import { AdminFilesService } from './admin-files.service';

@Module({
  controllers: [AdminFilesController],
  providers: [AdminFilesService],
})
export class AdminFilesModule {}
