import { IsNotEmpty, IsString } from 'class-validator';

export class UploadDriverPhotoDto {
  @IsString()
  @IsNotEmpty()
  dataUrl: string;
}
