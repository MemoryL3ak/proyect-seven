import { IsArray, IsString } from 'class-validator';

/** Participantes a los que se les manda el código de acceso desde el panel. */
export class SendAccessCodesDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
