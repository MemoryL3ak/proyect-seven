import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const INCIDENT_CATEGORIES = [
  'TRANSPORTE',
  'SEDE',
  'ALIMENTACION',
  'ALOJAMIENTO',
  'SALUD',
  'SEGURIDAD',
  'OTRO',
] as const;
export const INCIDENT_SEVERITIES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export const INCIDENT_STATUSES = ['ABIERTA', 'EN_CURSO', 'RESUELTA', 'CERRADA'] as const;

export class CreateIncidentDto {
  @IsString()
  @IsOptional()
  eventId?: string;

  /** Un Jefe de Misión no la elige: se fuerza a su delegación. */
  @IsString()
  @IsOptional()
  delegationId?: string | null;

  @IsString()
  @IsOptional()
  venueId?: string | null;

  @IsString()
  @IsOptional()
  tripId?: string | null;

  @IsIn(INCIDENT_CATEGORIES)
  @IsOptional()
  category?: (typeof INCIDENT_CATEGORIES)[number];

  @IsIn(INCIDENT_SEVERITIES)
  @IsOptional()
  severity?: (typeof INCIDENT_SEVERITIES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  description?: string | null;
}
