import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  role: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  modules?: string[];

  @IsOptional()
  isTemporaryPassword?: boolean;

  // Teléfono de contacto. Hoy lo usa el rol Coordinador General: los portales
  // ofrecen escribirle por WhatsApp en vez de llamar al chofer.
  @IsString()
  @IsOptional()
  phone?: string;

  // Alcance de datos: un Jefe de Misión queda acotado a su delegación (región)
  // y el backend filtra monitoreo, incidencias, alimentación y calendario.
  @IsString()
  @IsOptional()
  delegationId?: string;

  @IsString()
  @IsOptional()
  delegationLabel?: string;

  // Módulos que sólo puede mirar (ver auth/permisos-panel). Mandarlo, aunque
  // vacío, activa los niveles: los cambios exigen el módulo con "editar".
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  soloVer?: string[];

  // Eventos que puede ver en el panel; vacío = todos.
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  eventIds?: string[];
}

export class LoginUserDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

export class UpdatePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}

export class ChangeOwnPasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}

export class ChangeTemporaryPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  temporaryPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
