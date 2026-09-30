import { IsArray } from 'class-validator';

/**
 * Cuerpo de PUT /events/:id/cobros-transporte. La lista se limpia y valida
 * en normalizarCobros (cobros-transporte.ts): acá sólo se exige que sea una
 * lista, igual que en las tarifas por lote de proveedores.
 */
export class GuardarCobrosTransporteDto {
  @IsArray()
  cobros: unknown[];
}
