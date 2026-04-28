import { IsString, IsNotEmpty } from 'class-validator';

export class MobileLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
