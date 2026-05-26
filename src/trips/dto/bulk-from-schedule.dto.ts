import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class ScheduleRowDto {
  @IsString()
  @IsOptional()
  busNumber?: string;

  @IsString()
  @IsOptional()
  legType?: string; // "Ida" | "Retorno" | "REGRESO"

  @IsString()
  @IsOptional()
  clientType?: string; // TF | TM | TA | VIP | T1 | FAMILIA_PARAPAN | COMITE_ORGANIZADOR | PROVEEDORES

  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  date?: string; // "1-nov" or "2026-11-01"

  @IsString()
  @IsOptional()
  discipline?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  activity?: string;

  @IsString()
  @IsOptional()
  presentationTime?: string; // "6:45"

  @IsString()
  @IsOptional()
  originName?: string;

  @IsString()
  @IsOptional()
  originAddress?: string;

  @IsString()
  @IsOptional()
  departureTime?: string; // "7:00"

  @IsString()
  @IsOptional()
  travelTime?: string; // "0:30"

  @IsString()
  @IsOptional()
  arrivalTime?: string; // "7:30"

  @IsString()
  @IsOptional()
  destinationName?: string;

  @IsString()
  @IsOptional()
  destinationAddress?: string;

  @IsString()
  @IsOptional()
  activityStart?: string;

  @IsString()
  @IsOptional()
  observation?: string;

  @IsString()
  @IsOptional()
  returnTime?: string;

  @IsInt()
  @IsOptional()
  passengerCount?: number;

  @IsInt()
  @IsOptional()
  wheelchairCount?: number;

  @IsString()
  @IsOptional()
  fleetAcronym?: string; // M1 | M4 | M5

  @IsString()
  @IsOptional()
  fleetType?: string; // "Van" | "Bus 44" | "Van Adaptada"

  @IsString()
  @IsOptional()
  vehiclePlate?: string;

  @IsString()
  @IsOptional()
  driverName?: string;

  @IsString()
  @IsOptional()
  driverPhone?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class BulkFromScheduleDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsArray()
  rows: ScheduleRowDto[];

  @IsString()
  @IsOptional()
  defaultYear?: string; // "2026" — used when date column is "1-nov"
}
