import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class AutoAssignDriversDto {
  @IsString()
  @IsOptional()
  eventId?: string;

  /** Fecha del día a procesar — ISO yyyy-mm-dd. Si se omite procesa todos los pendientes. */
  @IsString()
  @IsOptional()
  date?: string;

  /** Filtro por tipo de cliente (TF/TM/TA/VIP/...). Si se omite procesa todos los tipos. */
  @IsString()
  @IsOptional()
  clientType?: string;

  /** Filtro por flota (M1/M4/M5). Si se omite procesa todas. */
  @IsString()
  @IsOptional()
  fleetAcronym?: string;

  /** Solo procesar estos tripIds (override de filtros por fecha/cliente). */
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tripIds?: string[];

  /** Si true, no persiste asignaciones — solo devuelve plan. */
  @IsBoolean()
  @IsOptional()
  dryRun?: boolean;

  // ── Flexibilidad ────────────────────────────────────────────────────────────

  /** Strict: chofer debe tener clientType en allowedClientTypes. Default true. */
  @IsBoolean()
  @IsOptional()
  enforceClientTypeMatch?: boolean;

  /** Strict: vehículo del chofer debe coincidir con fleet_acronym del viaje. Default true. */
  @IsBoolean()
  @IsOptional()
  enforceFleetTypeMatch?: boolean;

  /** Strict: capacidad del vehículo ≥ PAX del viaje. Default true. */
  @IsBoolean()
  @IsOptional()
  respectVehicleCapacity?: boolean;

  /** Strict: viajes con wheelchairCount > 0 sólo a vehículos adaptados. Default true. */
  @IsBoolean()
  @IsOptional()
  respectWheelchair?: boolean;

  /** Intenta asignar mismo chofer al retorno del round trip. Default true. */
  @IsBoolean()
  @IsOptional()
  prioritizeRoundTrips?: boolean;

  /** Buffer entre viajes consecutivos del mismo chofer (minutos). Default 90 (= 1.5h). */
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(360)
  bufferMinutes?: number;

  /** Máximo de viajes que puede aceptar un chofer en el día. Null = sin tope. */
  @IsInt()
  @IsOptional()
  @Min(1)
  maxTripsPerDriver?: number;

  /** Estrategia de selección entre candidatos válidos. */
  @IsString()
  @IsOptional()
  @IsIn(['least_loaded', 'first_available', 'longest_idle'])
  strategy?: 'least_loaded' | 'first_available' | 'longest_idle';

  @IsString()
  @IsOptional()
  createdBy?: string;
}
