import { IsNotEmpty, IsString } from 'class-validator';

export class UploadVenuePhotoDto {
  @IsString()
  @IsNotEmpty()
  dataUrl: string;
}
