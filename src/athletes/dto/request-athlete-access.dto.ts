import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestAthleteAccessDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
