import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateTransportDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  plate: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  status?: string;

  // Flota fija por delegación (región) durante el evento.
  @IsString()
  @IsOptional()
  delegationId?: string | null;

  @IsString()
  @IsNotEmpty()
  type: string;
}
