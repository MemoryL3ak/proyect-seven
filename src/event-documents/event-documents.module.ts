import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventDocumentsController } from './event-documents.controller';
import { EventDocumentsService } from './event-documents.service';
import { EventDocument } from './entities/event-document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EventDocument])],
  controllers: [EventDocumentsController],
  providers: [EventDocumentsService],
})
export class EventDocumentsModule {}
