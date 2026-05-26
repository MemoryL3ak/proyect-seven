import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

// ── Persons ──────────────────────────────────────────────────────────────────

export class CreatePersonDto {
  @IsString()
  fullName: string;

  @IsOptional() @IsString() eventId?: string;
  @IsOptional() @IsString() rut?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() address?: string;

  @IsOptional()
  @IsIn(['STAFF', 'VOLUNTEER'])
  personType?: 'STAFF' | 'VOLUNTEER';

  @IsOptional() @IsString() role?: string;

  @IsOptional() @IsNumber() @Min(0)
  dailyRate?: number;

  @IsOptional() @IsInt() @Min(0)
  daysCount?: number;

  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdatePersonDto extends CreatePersonDto {
  @IsOptional() @IsString() declare fullName: string;
}

// ── Products ─────────────────────────────────────────────────────────────────

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional() @IsString() eventId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsBoolean() hasSizes?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) availableSizes?: string[];
  @IsOptional() @IsInt() @Min(0) stockQuantity?: number;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() status?: string;
}

export class UpdateProductDto extends CreateProductDto {
  @IsOptional() @IsString() declare name: string;
}

// ── Deliveries ───────────────────────────────────────────────────────────────

export class CreateDeliveryDto {
  @IsString()
  personId: string;

  @IsString()
  productId: string;

  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsString() size?: string;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsISO8601() deliveredAt?: string;
  @IsOptional() @IsString() deliveredBy?: string;
  @IsOptional() @IsISO8601() validatedAt?: string;
  @IsOptional() @IsString() validatedBy?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateDeliveryDto {
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsString() size?: string;
  @IsOptional() @IsISO8601() deliveredAt?: string;
  @IsOptional() @IsString() deliveredBy?: string;
  @IsOptional() @IsISO8601() validatedAt?: string;
  @IsOptional() @IsString() validatedBy?: string;
  @IsOptional() @IsString() notes?: string;
}
