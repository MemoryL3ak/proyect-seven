import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AskSofiaDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsOptional()
  previousResponseId?: string;

  /** Idioma de la interfaz: 'es' | 'en' | 'pt'. Default 'es'. */
  @IsString()
  @IsOptional()
  locale?: string;

  /** Evento que el panel tiene en pantalla (01-10-2026). Ver evento-de-consulta.ts. */
  @IsString()
  @IsOptional()
  eventId?: string;
}
