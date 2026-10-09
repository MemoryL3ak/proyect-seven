import { BadRequestException } from '@nestjs/common';

/**
 * Cambio de estado en lote desde la lista de Viajes (09-10-2026): la barra
 * de selección múltiple ofrece "Cambiar estado" junto a "Eliminar
 * seleccionados". Cada viaje pasa por el mismo `update` que el cambio de a
 * uno, así que conserva la bitácora, las marcas de inicio/cierre y los
 * avisos al pasajero.
 *
 * No hay ValidationPipe global: lo que llega en el cuerpo se valida acá.
 */

/** Estados a los que el panel puede llevar varios viajes de una vez. */
export const ESTADOS_CAMBIO_MASIVO = ['SCHEDULED', 'EN_ROUTE', 'PICKED_UP', 'COMPLETED', 'CANCELLED'] as const;
export type EstadoCambioMasivo = (typeof ESTADOS_CAMBIO_MASIVO)[number];

export const MAX_VIAJES_CAMBIO_MASIVO = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CambioMasivo = { ids: string[]; status: EstadoCambioMasivo };

/** Valida el cuerpo del POST /trips/bulk-status: ids únicos (uuid, tope 500) y un estado permitido. */
export function validarCambioMasivo(cuerpo: unknown): CambioMasivo {
  const b = (cuerpo ?? {}) as { ids?: unknown; status?: unknown };
  const status = String(b.status ?? '').trim().toUpperCase();
  if (!(ESTADOS_CAMBIO_MASIVO as readonly string[]).includes(status)) {
    throw new BadRequestException(`Estado no permitido: ${status || '(vacío)'}. Válidos: ${ESTADOS_CAMBIO_MASIVO.join(', ')}`);
  }
  if (!Array.isArray(b.ids) || b.ids.length === 0) throw new BadRequestException('ids es obligatorio');
  const ids = Array.from(new Set(b.ids.map((x) => String(x ?? '').trim())));
  if (ids.length > MAX_VIAJES_CAMBIO_MASIVO) throw new BadRequestException(`Máximo ${MAX_VIAJES_CAMBIO_MASIVO} viajes por llamada`);
  const malos = ids.filter((id) => !UUID.test(id));
  if (malos.length > 0) throw new BadRequestException(`ids inválidos: ${malos.slice(0, 3).join(', ')}`);
  return { ids, status: status as EstadoCambioMasivo };
}

export type ResultadoCambioMasivo = {
  requestedCount: number;
  updatedCount: number;
  /** Viajes que no se pudieron cambiar, con el motivo (p. ej., el viaje ya no existe). */
  errores: { id: string; mensaje: string }[];
};

/**
 * Aplica `cambiar` a cada id, de a `paralelo` a la vez, y junta el resultado.
 * Un viaje que falla no detiene a los demás.
 */
export async function aplicarCambioMasivo(
  ids: string[],
  cambiar: (id: string) => Promise<unknown>,
  paralelo = 4,
): Promise<ResultadoCambioMasivo> {
  const errores: { id: string; mensaje: string }[] = [];
  let updatedCount = 0;
  for (let i = 0; i < ids.length; i += paralelo) {
    const lote = ids.slice(i, i + paralelo);
    const resultados = await Promise.allSettled(lote.map((id) => cambiar(id)));
    resultados.forEach((r, j) => {
      if (r.status === 'fulfilled') updatedCount += 1;
      else errores.push({ id: lote[j], mensaje: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    });
  }
  return { requestedCount: ids.length, updatedCount, errores };
}
