import { ArrayMinSize, IsArray } from 'class-validator';
import { CreateSportsCalendarEventDto } from './create-sports-calendar-event.dto';

export class BulkCreateSportsCalendarEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  events: CreateSportsCalendarEventDto[];
}
