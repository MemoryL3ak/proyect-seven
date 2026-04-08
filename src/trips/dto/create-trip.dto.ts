import { IsArray, IsBoolean, IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateTripDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsOptional()
  driverId?: string;

  @IsString()
  @IsOptional()
  vehicleId?: string;

  @IsString()
  @IsOptional()
  vehiclePlate?: string;

  @IsString()
  @IsOptional()
  requesterAthleteId?: string;

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

  @IsString()
  @IsOptional()
  destination?: string;

  @IsString()
  @IsOptional()
  origin?: string;

  @IsString()
  @IsOptional()
  tripType?: string;

  @IsString()
  @IsOptional()
  clientType?: string;

  @IsNumber()
  @IsOptional()
  tripCost?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  athleteIds?: string[];

  @IsString()
  @IsOptional()
  status?: string;

  @IsObject()
  @IsOptional()
  routeGeometry?: Record<string, unknown>;

  @IsISO8601()
  @IsOptional()
  scheduledAt?: string;

  @IsISO8601()
  @IsOptional()
  startedAt?: string;

  @IsISO8601()
  @IsOptional()
  completedAt?: string;

  @IsISO8601()
  @IsOptional()
  requestedAt?: string;

  @IsNumber()
  @IsOptional()
  driverRating?: number;

  @IsString()
  @IsOptional()
  ratingComment?: string;

  @IsISO8601()
  @IsOptional()
  ratedAt?: string;

  @IsBoolean()
  @IsOptional()
  isRoundTrip?: boolean;

  @IsString()
  @IsOptional()
  parentTripId?: string;

  @IsString()
  @IsOptional()
  legType?: string;

  @IsISO8601()
  @IsOptional()
  returnScheduledAt?: string;

  @IsString()
  @IsOptional()
  returnOrigin?: string;

  @IsString()
  @IsOptional()
  returnDestination?: string;

  @IsString()
  @IsOptional()
  returnDestinationVenueId?: string;
}
