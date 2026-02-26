import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class ReviewAccreditationDto {
  @IsString()
  @IsOptional()
  validationNotes?: string;

  @IsString()
  @IsOptional()
  validatedBy?: string;

  @IsISO8601()
  @IsOptional()
  validatedAt?: string;
}
