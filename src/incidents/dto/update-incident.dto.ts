import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateIncidentDto, INCIDENT_STATUSES } from './create-incident.dto';

export class UpdateIncidentDto extends PartialType(CreateIncidentDto) {
  @IsIn(INCIDENT_STATUSES)
  @IsOptional()
  status?: (typeof INCIDENT_STATUSES)[number];

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  resolution?: string | null;
}
