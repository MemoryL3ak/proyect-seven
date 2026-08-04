import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class MobileDeleteAccountDto {
  @IsString()
  @IsIn(['athlete', 'driver', 'staff'])
  kind: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  /** Código de acceso del portal (últimos 6 del id): confirma la identidad. */
  @IsString()
  @IsNotEmpty()
  code: string;
}
