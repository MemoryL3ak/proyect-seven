import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AskSofiaDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsOptional()
  previousResponseId?: string;
}
