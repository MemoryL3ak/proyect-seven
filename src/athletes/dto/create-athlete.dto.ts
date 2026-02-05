import {
  IsISO8601,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateAthleteDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsOptional()
  delegationId?: string;

  @IsString()
  @IsOptional()
  disciplineId?: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @Length(3, 3)
  @IsOptional()
  countryCode?: string;

  @IsString()
  @IsOptional()
  passportNumber?: string;

  @IsISO8601()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  dietaryNeeds?: string;

  @IsString()
  @IsOptional()
  luggageType?: string;

  @IsString()
  @IsOptional()
  luggageNotes?: string;

  @IsString()
  @IsOptional()
  userType?: string;

  @IsString()
  @IsOptional()
  arrivalFlightId?: string;

  @IsISO8601()
  @IsOptional()
  arrivalTime?: string;

  @IsISO8601()
  @IsOptional()
  departureTime?: string;

  @IsString()
  @IsOptional()
  departureGate?: string;

  @IsString()
  @IsOptional()
  arrivalBaggage?: string;

  @IsString()
  @IsOptional()
  hotelAccommodationId?: string;

  @IsString()
  @IsOptional()
  roomNumber?: string;

  @IsString()
  @IsOptional()
  roomType?: string;

  @IsString()
  @IsOptional()
  bedType?: string;

  @IsBoolean()
  @IsOptional()
  isDelegationLead?: boolean;

  @IsString()
  @IsOptional()
  transportTripId?: string;

  @IsString()
  @IsOptional()
  transportVehicleId?: string;

  @IsISO8601()
  @IsOptional()
  airportCheckinAt?: string;

  @IsISO8601()
  @IsOptional()
  hotelCheckinAt?: string;

  @IsISO8601()
  @IsOptional()
  hotelCheckoutAt?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
