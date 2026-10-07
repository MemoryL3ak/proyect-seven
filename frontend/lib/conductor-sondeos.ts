/**
 * Sondeos periódicos del portal del conductor: qué se pide, cuándo y cuándo
 * no hace falta. Todo lo que corre en un temporizador dentro del teléfono
 * pasa por acá, para que se pueda medir sin abrir la pantalla.
 */

/** Cada cuánto se consulta si llegó una calificación nueva. */
export const SONDEO_CALIFICACIONES_MS = 60_000;
/** Sólo viajes cerrados en este lapso: los de días anteriores ya no van a cambiar. */
export const VENTANA_CALIFICACION_MS = 24 * 60 * 60 * 1000;
/**
 * Tope por petición periódica. Sin tope, con señal mala cada petición queda
 * colgada minutos y las siguientes se apilan encima.
 */
export const TIMEOUT_SONDEO_MS = 15_000;

export type ViajeCalificable = {
  id: string;
  status?: string | null;
  driverRating?: number | null;
  completedAt?: string | null;
  startedAt?: string | null;
};

/**
 * Ids de viajes cuya calificación vale la pena consultar: cerrados hace
 * menos de un día, sin calificación y no consultados ya con éxito. Antes se
 * consultaban TODOS los cerrados del conductor, uno por uno, cada 8 s.
 */
export function viajesPorCalificar(
  trips: ViajeCalificable[],
  yaCalificados: Set<string>,
  ahora: number,
  ventanaMs = VENTANA_CALIFICACION_MS,
): string[] {
  return trips
    .filter((t) => ["COMPLETED", "DROPPED_OFF"].includes(t.status ?? ""))
    .filter((t) => !t.driverRating && !yaCalificados.has(t.id))
    .filter((t) => {
      const cierre = new Date(t.completedAt ?? t.startedAt ?? "").getTime();
      return Number.isFinite(cierre) && ahora - cierre <= ventanaMs;
    })
    .map((t) => t.id);
}

export type EstadoRastreoShell =
  | {
      running?: boolean;
      backgroundOk?: boolean;
      gpsServices?: boolean;
      background?: string;
      batteryOptimized?: boolean | null;
      /** Último intento de envío de un fijo por el shell (reloj del teléfono). */
      lastPush?: { lastAttemptAt?: number | null } | null;
      /** Calculado por el portal con shellSinFijos: "dice que rastrea, no entrega". */
      sinFijos?: boolean;
    }
  | null
  | undefined;

/**
 * Cuánto puede pasar sin que el shell intente mandar un fijo antes de darlo
 * por mudo. Rastreando manda uno cada 3 s (con red o sin ella: el intento
 * fallido también cuenta), así que 45 s es quince veces la cadencia.
 */
export const UMBRAL_SIN_FIJOS_MS = 45_000;

/**
 * El shell dice que rastrea (`running: true`) pero no entrega posiciones.
 * 07-10-2026, Armando Soza (Galaxy S25, app abierta, "rastreo en segundo
 * plano"): dos fijos al abrir y nada más, y como el portal confiaba en
 * `running` apagaba su propio GPS. En seis días pasó en 91 de 293 sesiones
 * Android (iPhone: 5 de 382). La tarea queda registrada en Android pero el
 * servicio en primer plano no vuelve a arrancar, y el sistema entrega un
 * puñado de posiciones por hora.
 *
 * `sinIntentosDesde`: cuándo se vio por primera vez `running` sin ningún
 * intento registrado (tras reiniciar la app el contador parte vacío).
 */
export function shellSinFijos(estado: EstadoRastreoShell, ahora: number, sinIntentosDesde: number | null): boolean {
  if (!estado || estado.running !== true) return false;
  const intento = estado.lastPush?.lastAttemptAt ?? null;
  const referencia = intento ?? sinIntentosDesde;
  if (referencia == null) return false;
  return ahora - referencia > UMBRAL_SIN_FIJOS_MS;
}

/**
 * Esperas entre reintentos de tracking.status cuando el shell no responde a
 * tiempo (30-09-2026). Antes un solo intento fallido "se omitía" y el rastreo
 * nativo quedaba sin armar hasta el próximo login.
 */
export const ESPERAS_ESTADO_SHELL_MS = [5_000, 15_000, 45_000];

/** Como mucho un rearme del rastreo nativo por minuto. */
export const ESPERA_REARME_MS = 60_000;

/**
 * Si hay que volver a pedir tracking.start al shell: tenía permiso "todo el
 * tiempo" y GPS encendido, pero el rastreo aparece detenido —Android mató el
 * servicio con la app (30-09-2026: conductores con la app instalada mandaban
 * un punto cada 5 o 10 minutos, sólo al abrirla). Nadie lo rearmaba hasta el
 * próximo login. Sin permiso de fondo o con el GPS apagado no se insiste:
 * tracking.start abriría los diálogos del sistema una y otra vez.
 */
export function debeRearmarRastreo(
  estado: EstadoRastreoShell,
  ahora: number,
  ultimoRearme: number,
  espera = ESPERA_REARME_MS,
): boolean {
  if (!estado) return false;
  // Detenido, o "andando" sin entregar nada (shellSinFijos): en ambos casos
  // hay que volver a armar. El segundo se rearma con tracking.stop +
  // tracking.start, porque el shell responde "ya está corriendo" a un start
  // solo.
  if (estado.running !== false && estado.sinFijos !== true) return false;
  if (estado.backgroundOk !== true || estado.gpsServices === false) return false;
  return ahora - ultimoRearme >= espera;
}

/**
 * El shell emite tracking.statusChanged cada 3 s aunque no cambie nada (trae
 * el último envío): sólo estos campos le importan al portal, y con ellos
 * iguales no se vuelve a pintar la pantalla ni se rearma el GPS web.
 */
export function mismoEstadoShell(a: EstadoRastreoShell, b: EstadoRastreoShell): boolean {
  if (!a || !b) return !a && !b;
  return (
    a.running === b.running &&
    a.backgroundOk === b.backgroundOk &&
    a.gpsServices === b.gpsServices &&
    a.background === b.background &&
    (a.batteryOptimized ?? null) === (b.batteryOptimized ?? null) &&
    (a.sinFijos ?? false) === (b.sinFijos ?? false)
  );
}

/**
 * Si el portal web tiene que mandar GPS por su cuenta. Dentro de la app, con
 * el rastreo del shell andando y permiso de segundo plano, ya sale un fijo
 * cada 3 s por la vía nativa: mandarlo también desde la web duplica las
 * peticiones del teléfono (el servidor descarta el duplicado igual).
 */
export function gpsWebNecesario(shell: EstadoRastreoShell, dentroDeLaApp: boolean): boolean {
  if (!dentroDeLaApp) return true;
  // Un shell que dice rastrear pero no entrega (sinFijos) no cuenta como
  // cobertura: la web vuelve a mandar mientras la app esté a la vista.
  return !(shell?.running === true && shell.backgroundOk === true && shell.sinFijos !== true);
}

/** Señal de corte para una petición periódica; sin soporte del navegador, ninguna. */
export function senalDeCorte(ms = TIMEOUT_SONDEO_MS): AbortSignal | undefined {
  try {
    return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(ms) : undefined;
  } catch {
    return undefined;
  }
}
