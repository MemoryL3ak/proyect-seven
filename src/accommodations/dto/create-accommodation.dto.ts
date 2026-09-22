import { IsArray, IsInt, IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export const ACCOMMODATION_CONTACT_ROLES = ['COORDINADOR', 'APOYO'] as const;
export const ACCOMMODATION_CONTACT_SHIFTS = ['TODO_EL_DIA', 'AM', 'PM'] as const;

export type AccommodationContactRole = (typeof ACCOMMODATION_CONTACT_ROLES)[number];
export type AccommodationContactShift = (typeof ACCOMMODATION_CONTACT_SHIFTS)[number];

/**
 * Una persona de contacto del hotel. El turno sólo lo trae el apoyo —"(all
 * day)", "(pm)" en la planilla de operaciones—; en el coordinador va vacío.
 *
 * No lleva decoradores por elemento a propósito: el proyecto no monta un
 * ValidationPipe global, así que class-validator no corre. Lo que de verdad
 * saca la basura es `sanitizeCoordinators` en el servicio, antes de escribir.
 */
export type AccommodationCoordinatorDto = {
  name: string;
  phone: string | null;
  role: AccommodationContactRole;
  shift: AccommodationContactShift | null;
};

export class CreateAccommodationDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  accommodationType?: string;

  @IsString()
  @IsOptional()
  tower?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string | null;

  @IsObject()
  @IsOptional()
  geoLocation?: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @IsOptional()
  totalCapacity?: number;

  @IsObject()
  @IsOptional()
  roomInventory?: Record<string, number>;

  @IsObject()
  @IsOptional()
  bedInventory?: Record<string, number>;

  @IsISO8601()
  @IsOptional()
  checkIn?: string | null;

  @IsISO8601()
  @IsOptional()
  checkOut?: string | null;

  /** Coordinadores y apoyos del hotel, en el orden en que se muestran. */
  @IsArray()
  @IsOptional()
  coordinators?: AccommodationCoordinatorDto[];
}
