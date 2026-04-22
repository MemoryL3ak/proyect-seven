import { IsOptional, IsString, MinLength } from 'class-validator';

export class ScanDto {
  @IsString()
  @MinLength(4)
  code: string;

  @IsString()
  scannedById: string;

  @IsOptional()
  @IsString()
  scannedByName?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
