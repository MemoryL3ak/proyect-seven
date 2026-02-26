import { PartialType } from '@nestjs/mapped-types';
import { CreateSportsCalendarEventDto } from './create-sports-calendar-event.dto';

export class UpdateSportsCalendarEventDto extends PartialType(
  CreateSportsCalendarEventDto,
) {}
