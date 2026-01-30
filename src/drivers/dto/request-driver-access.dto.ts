import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestDriverAccessDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
