/**
 * Traslados que genera una ficha de AND (27-09-2026, pedido de Ariel para
 * World Rugby U20): al guardar un participante con su vuelo, el vuelo de
 * llegada aparece en el Monitor de Vuelos y se crea su traslado, asignado al
 * conductor elegido en la ficha para que lo vea en sus actividades.
 *
 * Desde el 28-09-2026 es UN solo viaje "Transfer In Out" por persona: la
 * llegada (aeropuerto → hotel) es el viaje y la salida (hotel → aeropuerto)
 * su tramo de regreso, igual que cualquier viaje de ida y vuelta. Cada tramo
 * conserva su conductor y su propio Iniciar / Finalizar en la app.
 *
 * Aquí va la regla sin base de datos: qué tramos corresponden a una ficha.
 */

/** El mismo aeropuerto que usa Viajes al elegir Transfer In / Out. */
export const AEROPUERTO =
  'Aeropuerto Internacional Arturo Merino Benítez, Pudahuel, Santiago, Chile';

/**
 * El traslado de salida recoge en el hotel con esta anticipación al vuelo:
 * los vuelos de AND son en su mayoría internacionales (3 h de embarque).
 * Se puede corregir en Viajes; el traslado no se vuelve a mover mientras la
 * ficha no cambie su vuelo.
 */
export const ANTICIPACION_SALIDA_MIN = 180;

export type SentidoAnd = 'LLEGADA' | 'SALIDA';

export type FichaAnd = {
  id: string;
  trip_type?: string | null;
  flight_number?: string | null;
  airline?: string | null;
  arrival_time?: string | Date | null;
  departure_time?: string | Date | null;
  transport_type?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Tipo de servicio con llegada y salida: la llegada es el viaje y la salida su regreso. */
export const TIPO_TRANSFER_IN_OUT = 'TRANSFER_IN_OUT';
/**
 * Con un solo tramo (29-09-2026, "dice Transfer In Out y es solo IN"): sólo
 * llegada es Transfer In; sólo salida, Transfer Out. Se cobran con la tarifa
 * de Transfer In Out, igual que antes (ver trips-finance y lookupClientPrice).
 */
export const TIPO_TRANSFER_IN = 'TRANSFER_IN';
export const TIPO_TRANSFER_OUT = 'TRANSFER_OUT';
export type TipoTransfer = typeof TIPO_TRANSFER_IN_OUT | typeof TIPO_TRANSFER_IN | typeof TIPO_TRANSFER_OUT;

/** Tipo de cada tramo según los que tenga la ficha. */
export function tipoDeTramo(sentido: SentidoAnd, hayLlegada: boolean, haySalida: boolean): TipoTransfer {
  if (hayLlegada && haySalida) return TIPO_TRANSFER_IN_OUT;
  return sentido === 'LLEGADA' ? TIPO_TRANSFER_IN : TIPO_TRANSFER_OUT;
}

export type TramoAnd = {
  sentido: SentidoAnd;
  /** Transfer In Out con los dos tramos; Transfer In o Out con uno solo. */
  tipoViaje: TipoTransfer;
  /** Clave del viaje en su metadata: una ficha tiene a lo más uno por sentido. */
  clave: string;
  vuelo: string;
  aerolinea: string | null;
  /** Hora del vuelo (aterrizaje o despegue), ISO. */
  horaVuelo: string;
  /** Hora del traslado: al aterrizar, o la anticipación antes del despegue. */
  horaViaje: string;
  conductorId: string | null;
  /** Tipo de flota de la plantilla de AND: vehículo pedido del traslado. */
  flota: string | null;
  /** Patente que trae la plantilla (queda en la metadata del viaje). */
  patente: string | null;
};

const registro = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

const texto = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

const iso = (v: unknown): string | null => {
  if (!v) return null;
  const d =
    v instanceof Date
      ? v
      : typeof v === 'string' || typeof v === 'number'
        ? new Date(v)
        : null;
  if (!d) return null;
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** "la 1324" → "LA1324": así se agrupan los pasajeros de un mismo vuelo. */
export const normalizarVuelo = (vuelo: string) =>
  vuelo.replace(/\s+/g, '').toUpperCase();

export const claveTrasladoAnd = (fichaId: string, sentido: SentidoAnd) =>
  `and:${fichaId}:${sentido}`;

/**
 * Tramos de una ficha. Hace falta vuelo y hora: sin número de vuelo no hay
 * nada que monitorear ni a quién esperar. Quien llega en bus no genera
 * traslado al aeropuerto.
 *
 * La carga de AND guarda llegada y salida en metadata.arrival / departure;
 * el formulario además escribe la fila (flight_number, arrival_time,
 * departure_time). Las horas se leen primero de la fila (cualquier edición
 * las escribe ahí); el número de vuelo, primero de la metadata, porque la
 * fila tiene uno solo.
 */
export function tramosAnd(ficha: FichaAnd): TramoAnd[] {
  if (String(ficha.transport_type ?? '').toUpperCase() === 'BUS') return [];
  const meta = registro(ficha.metadata);
  const llegada = registro(meta.arrival);
  const salida = registro(meta.departure);
  const esSalida = String(ficha.trip_type ?? '').toUpperCase() === 'DEPARTURE';
  const tramos: TramoAnd[] = [];

  const vueloLlegada =
    texto(llegada.flightNumber) ??
    (!esSalida ? texto(ficha.flight_number) : null);
  const horaLlegada = iso(ficha.arrival_time) ?? iso(llegada.time);
  if (vueloLlegada && horaLlegada) {
    tramos.push({
      sentido: 'LLEGADA',
      tipoViaje: TIPO_TRANSFER_IN_OUT,
      clave: claveTrasladoAnd(ficha.id, 'LLEGADA'),
      vuelo: normalizarVuelo(vueloLlegada),
      aerolinea: texto(llegada.airline) ?? texto(ficha.airline),
      horaVuelo: horaLlegada,
      horaViaje: horaLlegada,
      conductorId: texto(llegada.driverId),
      flota: texto(llegada.fleetType),
      patente: texto(llegada.vehiclePlate),
    });
  }

  const vueloSalida =
    texto(salida.flightNumber) ??
    (esSalida ? texto(ficha.flight_number) : null);
  const horaSalida = iso(ficha.departure_time) ?? iso(salida.time);
  if (vueloSalida && horaSalida) {
    tramos.push({
      sentido: 'SALIDA',
      tipoViaje: TIPO_TRANSFER_IN_OUT,
      clave: claveTrasladoAnd(ficha.id, 'SALIDA'),
      vuelo: normalizarVuelo(vueloSalida),
      aerolinea:
        texto(salida.airline) ?? (esSalida ? texto(ficha.airline) : null),
      horaVuelo: horaSalida,
      horaViaje: new Date(
        new Date(horaSalida).getTime() - ANTICIPACION_SALIDA_MIN * 60_000,
      ).toISOString(),
      conductorId: texto(salida.driverId),
      flota: texto(salida.fleetType),
      patente: texto(salida.vehiclePlate),
    });
  }
  const hayLlegada = tramos.some((t) => t.sentido === 'LLEGADA');
  const haySalida = tramos.some((t) => t.sentido === 'SALIDA');
  for (const t of tramos) t.tipoViaje = tipoDeTramo(t.sentido, hayLlegada, haySalida);
  return tramos;
}

/** Un tramo de AND tal como está guardado en transport.trips. */
export type TramoGuardado = {
  id: string;
  tripType: string | null;
  parentTripId: string | null;
  legType: string | null;
  isRoundTrip: boolean | null;
  returnAt: string | Date | null;
  scheduledAt: string | Date | null;
};

export type ArregloTramo = {
  id: string;
  tripType: string;
  parentTripId: string | null;
  legType: string | null;
  isRoundTrip: boolean;
  returnAt: string | null;
};

/**
 * Cómo tienen que quedar los tramos de una ficha para ser un solo Transfer
 * In Out: con llegada y salida, la llegada es la ida (OUTBOUND, guarda la
 * hora de regreso) y la salida su regreso (RETURN, colgada de la llegada).
 * Con un solo tramo, ése es el viaje, sin regreso, y es Transfer In (sólo
 * llegada) o Transfer Out (sólo salida). Devuelve sólo los tramos
 * que hay que cambiar; los traslados de antes (Transfer In y Transfer Out
 * separados) también se unen, aunque ya hayan partido: es la forma del
 * viaje, no lo que pasó en la calle.
 */
export function arregloTransferInOut(
  llegada: TramoGuardado | null,
  salida: TramoGuardado | null,
): ArregloTramo[] {
  const deseados: ArregloTramo[] = [];
  if (llegada) {
    deseados.push({
      id: llegada.id,
      tripType: tipoDeTramo('LLEGADA', true, Boolean(salida)),
      parentTripId: null,
      legType: salida ? 'OUTBOUND' : null,
      isRoundTrip: Boolean(salida),
      returnAt: salida ? iso(salida.scheduledAt) : null,
    });
  }
  if (salida) {
    deseados.push({
      id: salida.id,
      tripType: tipoDeTramo('SALIDA', Boolean(llegada), true),
      parentTripId: llegada ? llegada.id : null,
      legType: llegada ? 'RETURN' : null,
      isRoundTrip: Boolean(llegada),
      returnAt: null,
    });
  }
  const actuales = new Map(
    [llegada, salida]
      .filter((t): t is TramoGuardado => Boolean(t))
      .map((t) => [t.id, t] as const),
  );
  return deseados.filter((d) => {
    const a = actuales.get(d.id)!;
    return (
      a.tripType !== d.tripType ||
      (a.parentTripId ?? null) !== d.parentTripId ||
      (a.legType ?? null) !== d.legType ||
      Boolean(a.isRoundTrip) !== d.isRoundTrip ||
      iso(a.returnAt) !== d.returnAt
    );
  });
}

/** Estados en los que el traslado todavía se puede reprogramar solo. */
export const ESTADOS_SIN_INICIAR = new Set(['REQUESTED', 'SCHEDULED']);

export type ViajeAnd = {
  status: string;
  scheduledAt: string | null;
  driverId: string | null;
  /** Conductor que puso AND en el viaje (metadata.andDriverId). */
  andDriverId?: string | null;
  origin: string | null;
  destination: string | null;
  flightNumber: string | null;
  requestedVehicleType?: string | null;
  /** Patente que puso AND (metadata.andPatente). */
  andPatente?: string | null;
};

export type CambiosTraslado = Partial<{
  scheduledAt: string;
  /** null = quitar el conductor que había puesto AND. */
  driverId: string | null;
  origin: string;
  destination: string;
  flightNumber: string;
  requestedVehicleType: string;
  andPatente: string;
}>;

/**
 * Lo que hay que cambiarle a un traslado ya creado para que calce con su
 * ficha. Vacío si ya calza o si el viaje ya partió: lo que pasó en la calle
 * no lo reescribe una edición de la ficha.
 */
export function cambiosDeTraslado(
  actual: ViajeAnd,
  deseado: {
    scheduledAt: string;
    driverId: string | null;
    origin: string;
    destination: string;
    flightNumber: string;
    flota?: string | null;
    patente?: string | null;
  },
): CambiosTraslado {
  if (!ESTADOS_SIN_INICIAR.has(actual.status)) return {};
  const cambios: CambiosTraslado = {};
  if (iso(actual.scheduledAt) !== deseado.scheduledAt)
    cambios.scheduledAt = deseado.scheduledAt;
  // El conductor de la ficha se pone o se cambia. Si la ficha queda sin
  // conductor, se quita del viaje sólo si lo había puesto AND: el que asignó
  // despacho en Viajes no se toca.
  if (deseado.driverId && actual.driverId !== deseado.driverId)
    cambios.driverId = deseado.driverId;
  if (
    !deseado.driverId &&
    actual.driverId &&
    actual.andDriverId &&
    actual.driverId === actual.andDriverId
  )
    cambios.driverId = null;
  if ((actual.origin ?? '') !== deseado.origin) cambios.origin = deseado.origin;
  if ((actual.destination ?? '') !== deseado.destination)
    cambios.destination = deseado.destination;
  if (normalizarVuelo(actual.flightNumber ?? '') !== deseado.flightNumber)
    cambios.flightNumber = deseado.flightNumber;
  // Flota y patente de la plantilla: se ponen o se cambian; una ficha sin
  // ellas no borra lo que dejó despacho.
  if (deseado.flota && actual.requestedVehicleType !== deseado.flota)
    cambios.requestedVehicleType = deseado.flota;
  if (deseado.patente && actual.andPatente !== deseado.patente)
    cambios.andPatente = deseado.patente;
  return cambios;
}

/* ────────────────────────────────────────────────────────────────────────
 * Un traslado por grupo, no por persona (16-10-2026, pedido de Ariel).
 *
 * Los 22 jugadores de México llegaron en tres vuelos y Viajes mostraba 22
 * traslados de 1 pax, todos iguales, y el conductor tuvo que iniciar y
 * cerrar 22 veces el mismo viaje. Las fichas que comparten delegación,
 * vuelo, hotel y conductor viajan juntas: son UN viaje con todos como
 * pasajeros (transport.trip_athletes) y `passenger_count` igual al grupo.
 *
 * En la metadata del viaje:
 *   - andKeys:  claves "and:<ficha>:<sentido>" de todas sus fichas.
 *   - andKey:   la primera de ellas (lo que leía todo hasta hoy sigue
 *               funcionando: Monitor de Vuelos, planilla de AND, sentido).
 *   - andGrupo: la clave del grupo, para que la siguiente ficha igual se sume
 *               a este viaje en vez de crear otro.
 * ──────────────────────────────────────────────────────────────────────── */

export type GrupoAnd = {
  sentido: SentidoAnd;
  /** Vuelo normalizado ("LA715"). */
  vuelo: string;
  /** Hora del vuelo, ISO. */
  horaVuelo: string;
  delegationId: string | null;
  /** Hotel de destino (llegada) o de origen (salida). */
  hotelId: string | null;
  /** Conductor puesto en la ficha: distinto conductor, distinto vehículo. */
  conductorId: string | null;
};

/** Clave del grupo que viaja junto: mismo sentido, vuelo, hora, delegación, hotel y conductor. */
export const claveGrupoAnd = (g: GrupoAnd) =>
  [
    'and:grupo',
    g.sentido,
    normalizarVuelo(g.vuelo),
    g.horaVuelo,
    g.delegationId ?? '-',
    g.hotelId ?? '-',
    g.conductorId ?? '-',
  ].join(':');

/** "and:<ficha>:LLEGADA" → "<ficha>"; null si no es una clave de ficha. */
export const fichaDeClave = (clave: string): string | null => {
  const m = /^and:([^:]+):(LLEGADA|SALIDA)$/.exec(clave);
  return m ? m[1] : null;
};

/** "and:<ficha>:LLEGADA" → "LLEGADA". */
export const sentidoDeClave = (clave: string): SentidoAnd | null => {
  const m = /^and:[^:]+:(LLEGADA|SALIDA)$/.exec(clave);
  return m ? (m[1] as SentidoAnd) : null;
};

/**
 * Claves de ficha de un viaje de AND: `andKeys` y, en los viajes de antes
 * (uno por persona), su único `andKey`.
 */
export function clavesDelViaje(metadata: unknown): string[] {
  const meta = registro(metadata);
  const lista = Array.isArray(meta.andKeys)
    ? meta.andKeys.filter((k): k is string => typeof k === 'string' && k.length > 0)
    : [];
  if (lista.length > 0) return Array.from(new Set(lista));
  const unica = texto(meta.andKey);
  return unica ? [unica] : [];
}

/** Fichas (ids) que viajan en un viaje de AND, en el orden en que se sumaron. */
export const fichasDelViaje = (metadata: unknown): string[] =>
  clavesDelViaje(metadata)
    .map(fichaDeClave)
    .filter((id): id is string => Boolean(id));

/** Las mismas fichas, sin importar el orden. */
export function mismasFichas(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size || sa.size === 0) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

/** Lo que hace falta de un viaje guardado para saber a qué grupo pertenece. */
export type ViajeAgrupable = {
  metadata?: unknown;
  delegation_id?: string | null;
  destination_hotel_id?: string | null;
  origin_hotel_id?: string | null;
};

/**
 * Grupo de un viaje de AND ya guardado: el que trae en `andGrupo` o, en los
 * viajes de antes de los grupos, el que se deduce de sus propios datos. Así
 * una ficha que ya tenía su traslado no lo abandona al volver a guardarse.
 */
export function grupoDelViaje(viaje: ViajeAgrupable): string | null {
  const meta = registro(viaje.metadata);
  const guardado = texto(meta.andGrupo);
  if (guardado) return guardado;
  const [clave] = clavesDelViaje(meta);
  const sentido = clave ? sentidoDeClave(clave) : null;
  const vuelo = texto(meta.flightNumber);
  const horaVuelo = iso(meta.flightTime);
  if (!sentido || !vuelo || !horaVuelo) return null;
  return claveGrupoAnd({
    sentido,
    vuelo,
    horaVuelo,
    delegationId: viaje.delegation_id ?? null,
    hotelId:
      (sentido === 'LLEGADA' ? viaje.destination_hotel_id : viaje.origin_hotel_id) ?? null,
    conductorId: texto(meta.andDriverId),
  });
}
