import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RejectAccreditationDto {
  @IsString()
  @IsNotEmpty()
  validationNotes: string;

  @IsString()
  @IsOptional()
  validatedBy?: string;

  @IsISO8601()
  @IsOptional()
  validatedAt?: string;
}
