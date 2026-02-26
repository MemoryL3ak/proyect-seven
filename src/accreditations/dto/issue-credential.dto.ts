import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class IssueCredentialDto {
  @IsString()
  @IsNotEmpty()
  credentialCode: string;

  @IsString()
  @IsOptional()
  credentialIssuedBy?: string;

  @IsISO8601()
  @IsOptional()
  credentialIssuedAt?: string;
}
