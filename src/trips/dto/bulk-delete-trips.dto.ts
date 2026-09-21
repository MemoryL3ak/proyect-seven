import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class BulkDeleteTripsDto {
  // Borrado en lote desde la lista de viajes. El tope evita que un clic
  // accidental sobre "seleccionar todo" mande miles de ids en una sola llamada.
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  ids: string[];
}
