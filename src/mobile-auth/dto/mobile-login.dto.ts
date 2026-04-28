import { IsString, IsNotEmpty } from 'class-validator';

export class MobileLoginDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  secret: string;
}
