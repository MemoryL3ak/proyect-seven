import { IsNotEmpty, IsString } from 'class-validator';

export class UploadProviderDocumentDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  dataUrl: string;
}
