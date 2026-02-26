import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAccreditationDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsIn(['PARTICIPANT', 'DRIVER'])
  subjectType: 'PARTICIPANT' | 'DRIVER';

  @IsString()
  @IsOptional()
  athleteId?: string;

  @IsString()
  @IsOptional()
  driverId?: string;

  @IsString()
  @IsIn(['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CREDENTIAL_ISSUED'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  validationNotes?: string;

  @IsString()
  @IsOptional()
  validatedBy?: string;

  @IsISO8601()
  @IsOptional()
  validatedAt?: string;

  @IsString()
  @IsOptional()
  credentialCode?: string;

  @IsISO8601()
  @IsOptional()
  credentialIssuedAt?: string;

  @IsString()
  @IsOptional()
  credentialIssuedBy?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
