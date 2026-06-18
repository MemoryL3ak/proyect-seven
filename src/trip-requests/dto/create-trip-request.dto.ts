import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

/** Tipos de cliente que solicitan viajes desde la app. */
export const APP_CLIENT_TYPES = ['T1', 'VIP'] as const;
export type AppClientType = (typeof APP_CLIENT_TYPES)[number];

/**
 * Solicitud de viaje generada desde la app por un pasajero T1 o VIP.
 * Sólo se aceptan estos dos tipos de cliente en este submódulo.
 */
export class CreateTripRequestDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsIn(APP_CLIENT_TYPES, {
    message: 'clientType debe ser T1 o VIP',
  })
  clientType: AppClientType;

  @IsString()
  @IsOptional()
  requesterAthleteId?: string;

  @IsString()
  @IsOptional()
  origin?: string;

  @IsString()
  @IsOptional()
  destination?: string;

  @IsString()
  @IsOptional()
  destinationVenueId?: string;

  @IsString()
  @IsOptional()
  destinationHotelId?: string;

  @IsString()
  @IsOptional()
  requestedVehicleType?: string;

  @IsNumber()
  @IsOptional()
  passengerCount?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  passengerLat?: number;

  @IsNumber()
  @IsOptional()
  passengerLng?: number;

  @IsISO8601()
  @IsOptional()
  scheduledAt?: string;
}
