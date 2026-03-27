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
  @IsOptional()
  phone?: string;

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

  @IsOptional()
  bolsoCount?: number;

  @IsOptional()
  bag8Count?: number;

  @IsOptional()
  suitcase10Count?: number;

  @IsOptional()
  suitcase15Count?: number;

  @IsOptional()
  suitcase23Count?: number;

  @IsString()
  @IsOptional()
  oversizeText?: string;

  @IsString()
  @IsOptional()
  luggageVolume?: string;

  @IsString()
  @IsOptional()
  userType?: string;

  @IsBoolean()
  @IsOptional()
  visaRequired?: boolean;

  @IsString()
  @IsOptional()
  tripType?: string;

  @IsString()
  @IsOptional()
  arrivalFlightId?: string;

  @IsString()
  @IsOptional()
  flightNumber?: string;

  @IsString()
  @IsOptional()
  airline?: string;

  @IsString()
  @IsOptional()
  origin?: string;

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
  wheelchairUser?: boolean;

  @IsOptional()
  wheelchairStandardCount?: number;

  @IsOptional()
  wheelchairSportCount?: number;

  @IsString()
  @IsOptional()
  sportsEquipment?: string;

  @IsBoolean()
  @IsOptional()
  requiresAssistance?: boolean;

  @IsString()
  @IsOptional()
  observations?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  transportType?: string;

  @IsString()
  @IsOptional()
  busPlate?: string;

  @IsString()
  @IsOptional()
  busDriverName?: string;

  @IsString()
  @IsOptional()
  busCompany?: string;

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
  accreditationStatus?: string;

  @IsISO8601()
  @IsOptional()
  accreditationValidatedAt?: string;

  @IsString()
  @IsOptional()
  accreditationValidatedBy?: string;

  @IsString()
  @IsOptional()
  accreditationNotes?: string;

  @IsString()
  @IsOptional()
  credentialCode?: string;

  @IsISO8601()
  @IsOptional()
  credentialIssuedAt?: string;

  @IsString()
  @IsOptional()
  credentialIssuedBy?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
