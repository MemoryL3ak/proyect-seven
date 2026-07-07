import { IsEmail, IsNotEmpty } from 'class-validator';

export class MobileRecoverDto {
  @IsEmail({}, { message: 'Correo inválido' })
  @IsNotEmpty()
  email: string;
}
