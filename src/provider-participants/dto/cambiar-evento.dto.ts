/**
 * Quitar personas de un evento (o devolverlas) sin borrarlas. Sin
 * ValidationPipe global: el servicio revisa el cuerpo a mano.
 */
export class CambiarEventoDto {
  ids: string[];
  eventId: string;
}
