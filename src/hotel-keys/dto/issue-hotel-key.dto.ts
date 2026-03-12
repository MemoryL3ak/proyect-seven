import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class IssueHotelKeyDto {
  @IsString()
  @IsNotEmpty()
  holderName: string;

  @IsString()
  @IsOptional()
  holderType?: string;

  @IsString()
  @IsOptional()
  holderParticipantId?: string;

  @IsString()
  @IsOptional()
  actorName?: string;

  @IsString()
  @IsOptional()
  issuedAt?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
