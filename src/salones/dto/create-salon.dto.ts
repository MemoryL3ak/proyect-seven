import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateSalonDto {
  @IsString() @IsNotEmpty() hotelId: string;
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsOptional() type?: string;
  @IsInt() @Min(0) @IsOptional() capacity?: number;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() floor?: string;
  @IsString() @IsOptional() notes?: string;
}
