import { PartialType } from '@nestjs/mapped-types';
import { CreateEventDocumentDto } from './create-event-document.dto';

export class UpdateEventDocumentDto extends PartialType(
  CreateEventDocumentDto,
) {}
