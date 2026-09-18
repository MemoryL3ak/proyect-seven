import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class CreateDelegationDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  // País ISO 3166-1 ("CHL") o región ISO 3166-2 ("CL-VS"): en los Juegos
  // Escolares las delegaciones son las regiones de Chile.
  @IsString()
  @IsNotEmpty()
  @Length(3, 8)
  countryCode: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  disciplineIds?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  /** Nombre visible ("Región de Valparaíso"); se guarda en metadata.name. */
  @IsString()
  @IsOptional()
  name?: string;

  /**
   * Jefe de Misión: id del participante (core.athletes) de esta delegación que
   * queda como encargado (is_delegation_lead). Es un participante, no un
   * usuario del panel: entra por el portal con su código. null lo quita.
   */
  @IsString()
  @IsOptional()
  missionHeadId?: string | null;

  /** Hoteles donde se aloja y come la delegación (alimentación por región). */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  accommodationIds?: string[];

  /** Flota fija de la delegación durante el evento. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  driverIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  vehicleIds?: string[];
}
