/**
 * Un viaje que vuelve a Programado o Solicitado deja de haber empezado: hay
 * que borrar inicio y cierre. Antes el retroceso sólo cambiaba el estado y
 * `started_at` / `completed_at` quedaban con la hora del inicio equivocado,
 * y el control de jornada contaba desde ahí.
 */
const SIN_INICIAR = new Set(['SCHEDULED', 'REQUESTED']);
/** El conductor ya salió: hacia el pasajero o con él a bordo. */
const EN_MARCHA = new Set(['EN_ROUTE', 'PICKED_UP']);
const CERRADOS = new Set(['DROPPED_OFF', 'COMPLETED']);

export function retrocedeASinIniciar(
  estadoAnterior: string | null | undefined,
  estadoNuevo: string | null | undefined,
): boolean {
  if (!estadoNuevo || estadoNuevo === estadoAnterior) return false;
  return SIN_INICIAR.has(estadoNuevo) && !SIN_INICIAR.has(estadoAnterior ?? '');
}

type Marca = string | Date | null | undefined;

/**
 * Inicio y cierre que hay que estampar al cambiar de estado, si nadie los
 * mandó. El portal del conductor sólo marcaba el inicio al poner "Pasajero a
 * bordo", así que un viaje "En ruta" no tenía inicio y el control de jornada
 * decía "Sin iniciar" con el conductor ya manejando; y el panel, al cerrar un
 * viaje a mano, no marcaba nada.
 *
 * Lo que el viaje ya tenía guardado sólo vale si el viaje venía en marcha.
 * Un viaje que sale de Programado arranca de cero: si conserva marcas de un
 * inicio anterior equivocado (el 22-09 uno se inició y cerró por error a las
 * 18:55 y volvió a Programado con las marcas puestas), al salir "En ruta" al
 * día siguiente la jornada contaba desde la tarde anterior.
 */
export function marcasAlCambiarEstado(
  estadoAnterior: string | null | undefined,
  estadoNuevo: string | null | undefined,
  actual: { startedAt?: Marca; completedAt?: Marca },
  pedido: { startedAt?: string | null; completedAt?: string | null },
  ahora: Date,
): { started_at?: string | null; completed_at?: string | null } {
  if (!estadoNuevo || estadoNuevo === estadoAnterior) return {};
  const marcas: { started_at?: string | null; completed_at?: string | null } = {};
  const arrancaDeCero = SIN_INICIAR.has(estadoAnterior ?? '');
  const inicioGuardado = arrancaDeCero ? null : actual.startedAt;
  const cierreGuardado = arrancaDeCero ? null : actual.completedAt;
  const sinInicio = pedido.startedAt === undefined ? !inicioGuardado : !pedido.startedAt;
  const sinCierre = pedido.completedAt === undefined ? !cierreGuardado : !pedido.completedAt;
  if (EN_MARCHA.has(estadoNuevo) || CERRADOS.has(estadoNuevo)) {
    if (sinInicio) marcas.started_at = ahora.toISOString();
    // En marcha no hay cierre: el que quedara de antes es de otro intento.
    if (EN_MARCHA.has(estadoNuevo) && pedido.completedAt === undefined && actual.completedAt) {
      marcas.completed_at = null;
    }
  }
  if (CERRADOS.has(estadoNuevo) && sinCierre) {
    marcas.completed_at = ahora.toISOString();
  }
  return marcas;
}
