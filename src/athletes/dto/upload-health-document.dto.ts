import { IsNotEmpty, IsString } from 'class-validator';

export class UploadHealthDocumentDto {
  @IsString()
  @IsNotEmpty()
  dataUrl: string;
}
