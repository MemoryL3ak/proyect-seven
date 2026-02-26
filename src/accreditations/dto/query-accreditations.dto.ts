import { IsIn, IsOptional, IsString } from 'class-validator';

export class QueryAccreditationsDto {
  @IsString()
  @IsOptional()
  eventId?: string;

  @IsString()
  @IsIn(['PARTICIPANT', 'DRIVER'])
  @IsOptional()
  subjectType?: string;

  @IsString()
  @IsIn(['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CREDENTIAL_ISSUED'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  athleteId?: string;

  @IsString()
  @IsOptional()
  driverId?: string;

  @IsString()
  @IsOptional()
  credentialCode?: string;
}
