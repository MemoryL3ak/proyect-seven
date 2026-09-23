/**
 * Lectura de la planilla de operatividad (la de "N° Bus, Destino, Acrónimo…")
 * y su comparación contra los viajes que ya están en el sistema.
 *
 * Vive acá porque la usan dos pantallas: Operatividad diaria la carga, y
 * Viajes la cruza con lo cargado para marcar lo que difiere. Antes el lector
 * estaba dentro de la página de carga y no se podía reutilizar.
 */
import * as XLSX from "xlsx";

export type ScheduleRow = {
  busNumber?: string;
  legType?: string;
  clientType?: string;
  clientName?: string;
  /** Delegación (en los Juegos Escolares, la región) a la que sirve el viaje. */
  delegation?: string;
  date?: string;
  discipline?: string;
  gender?: string;
  activity?: string;
  presentationTime?: string;
  originName?: string;
  originAddress?: string;
  departureTime?: string;
  travelTime?: string;
  arrivalTime?: string;
  destinationName?: string;
  destinationAddress?: string;
  returnTime?: string;
  passengerCount?: number;
  wheelchairCount?: number;
  fleetAcronym?: string;
  fleetType?: string;
  vehiclePlate?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
  observation?: string;
};

/** Una fila leída, con la hoja y el número de fila de Excel de donde salió. */
export type FilaPlanilla = ScheduleRow & { hoja: string; fila: number };

export const COLUMN_ALIASES: Record<string, string> = {
  "n°bus": "busNumber",
  "nºbus": "busNumber",
  "n° bus": "busNumber",
  "destino": "legType",
  "acronimo": "clientType",
  "tipo de cliente": "clientName",
  // La delegación es la región en los Juegos Escolares, y las planillas la
  // escriben de las dos formas.
  "delegacion": "delegation",
  "delegación": "delegation",
  "delegacion/region": "delegation",
  "delegación/región": "delegation",
  "region": "delegation",
  "región": "delegation",
  "fecha": "date",
  "disciplina": "discipline",
  "genero": "gender",
  "género": "gender",
  "actividad": "activity",
  "presentación": "presentationTime",
  "presentacion": "presentationTime",
  "presentación ": "presentationTime",
  "lugar origen": "originName",
  "dirección": "originAddress",
  "direccion": "originAddress",
  "hora llegada bus": "departureTime",
  "hora salida origen": "departureTime",
  "t° traslado": "travelTime",
  "tº traslado": "travelTime",
  "t traslado": "travelTime",
  "hora llegada recinto": "arrivalTime",
  " recinto": "destinationName",
  "recinto": "destinationName",
  "regresar a las": "returnTime",
  "pax": "passengerCount",
  "sillas de rueda": "wheelchairCount",
  "sillas de ruedas": "wheelchairCount",
  "acrónimo flota": "fleetAcronym",
  "acronimo flota": "fleetAcronym",
  "tipo flota": "fleetType",
  "patente": "vehiclePlate",
  "conductor": "driverName",
  "teléfono": "driverPhone",
  "telefono": "driverPhone",
  "notas": "notes",
  "obs": "observation",
  "observacion": "observation",
  "observación": "observation",
};

export const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// Búsqueda de columnas insensible a acentos: la planilla real usa "Acrónimo",
// "Acrónimo Flota", "Presentación", etc. con tilde.
const NORMALIZED_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(COLUMN_ALIASES).map(([k, v]) => [stripAccents(k), v]),
);

export function normalizeKey(key: string): string | null {
  const k = stripAccents(String(key || "").toLowerCase().trim());
  return NORMALIZED_ALIASES[k] ?? null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
/** Decodificador de seriales de fecha de SheetJS, tipado (viene como `any`). */
type CodigoFecha = { y: number; m: number; d: number; H: number; M: number };
const ssf = (XLSX as unknown as { SSF: { parse_date_code: (v: number) => CodigoFecha | null } }).SSF;
const DATE_FIELDS = new Set(["date"]);
const TIME_FIELDS = new Set(["presentationTime", "departureTime", "arrivalTime", "returnTime"]);

// Excel entrega las celdas de fecha/hora como números (serial de fecha o
// fracción de día) apenas el archivo se abre/edita/guarda en Excel. El backend
// espera texto "YYYY-MM-DD" y "HH:MM". Usamos el decodificador de SheetJS.
export function coerceCell(norm: string, value: unknown): string {
  const isDate = DATE_FIELDS.has(norm);
  const isTime = TIME_FIELDS.has(norm);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (isDate) return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
    if (isTime) return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }
  if ((isDate || isTime) && typeof value === "number" && Number.isFinite(value)) {
    const c = ssf.parse_date_code(value);
    if (c) {
      if (isDate) return `${c.y}-${pad2(c.m)}-${pad2(c.d)}`;
      if (isTime) return `${pad2(c.H)}:${pad2(c.M)}`;
    }
  }
  if (value == null || typeof value === "object") return "";
  return String(value as string | number | boolean).trim();
}

export function toScheduleRow(raw: Record<string, unknown>): ScheduleRow {
  const out: Record<string, string | number> = {};
  Object.entries(raw).forEach(([k, v]) => {
    const norm = normalizeKey(k);
    if (!norm) return;
    const str = coerceCell(norm, v);
    if (!str) return;
    if (norm === "passengerCount" || norm === "wheelchairCount") {
      const n = parseInt(str, 10);
      if (!Number.isNaN(n)) out[norm] = n;
    } else {
      out[norm] = str;
    }
  });
  return out as ScheduleRow;
}

/** Una fila trae datos si tiene al menos lo que identifica un viaje. */
export const filaConDatos = (r: ScheduleRow) => Boolean(r.date || r.clientType || r.delegation || r.discipline);

/**
 * Lee un libro completo. La planilla real viene con una hoja por deporte, así
 * que se recorren todas y cada fila recuerda de cuál salió.
 */
export function leerPlanilla(data: ArrayBuffer | string, opciones: { soloPrimeraHoja?: boolean } = {}): FilaPlanilla[] {
  const wb = XLSX.read(data, { type: typeof data === "string" ? "binary" : "array" });
  const hojas = opciones.soloPrimeraHoja ? wb.SheetNames.slice(0, 1) : wb.SheetNames;
  const filas: FilaPlanilla[] = [];
  for (const hoja of hojas) {
    const ws = wb.Sheets[hoja];
    if (!ws) continue;
    const crudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    crudas.forEach((cruda, i) => {
      const fila = toScheduleRow(cruda);
      // +2: la fila 1 de Excel es la cabecera y el índice parte en 0.
      if (filaConDatos(fila)) filas.push({ ...fila, hoja, fila: i + 2 });
    });
  }
  return filas;
}

const MONTHS_ES: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

/** "15-10", "1-nov" o "2026-11-01" → "YYYY-MM-DD", igual que lo hace el backend. */
export function rowDateToIso(raw: string | undefined, defaultYear: string): string | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${pad2(+iso[2])}-${pad2(+iso[3])}`;
  const parts = t.split(/[-/\s]/).filter(Boolean);
  if (parts.length >= 2) {
    const day = parseInt(parts[0], 10);
    const mk = String(parts[1]).toLowerCase();
    const month = MONTHS_ES[mk] ?? parseInt(parts[1], 10);
    const year = parts[2] && /^\d{4}$/.test(parts[2]) ? Number(parts[2]) : Number(defaultYear);
    if (!Number.isNaN(day) && month >= 1 && month <= 12 && year) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }
  return null;
}

/** "Damas y Varones", "F", "MASCULINO" → Mixto / Femenino / Masculino. */
export function generoNormalizado(valor?: string | null): "Masculino" | "Femenino" | "Mixto" | "" {
  const v = stripAccents(String(valor ?? "").toLowerCase()).replace(/\s+/g, " ").trim();
  if (!v) return "";
  const femenino = /femenin|damas|mujer|^f$|^fem$/.test(v);
  const masculino = /masculin|varon|hombre|^m$|^masc$/.test(v);
  if (/mixt|ambos|^x$/.test(v) || (femenino && masculino)) return "Mixto";
  if (femenino) return "Femenino";
  if (masculino) return "Masculino";
  return "";
}

/** "Ida" / "Regreso" / "OUTBOUND" → OUTBOUND | RETURN. */
export const tramoNormalizado = (valor?: string | null): "OUTBOUND" | "RETURN" => {
  const v = String(valor ?? "").trim().toUpperCase();
  return v === "RETURN" || v === "RETORNO" || v === "REGRESO" || v === "VUELTA" ? "RETURN" : "OUTBOUND";
};

/** Texto comparable: minúsculas, sin tildes, sólo letras y números. */
export const claveTexto = (valor?: string | null) =>
  stripAccents(String(valor ?? "").toLowerCase()).replace(/[^a-z0-9]/g, "");

/** Región comparable: sin "Región de / del / de la" ni signos. */
const claveRegion = (valor?: string | null) =>
  claveTexto(
    stripAccents(String(valor ?? "").toLowerCase()).replace(
      /\bregion\b|\bde la\b|\bdel\b|\bde\b|\bmetropolitana\b|\bsantiago\b/g,
      " ",
    ),
  );

const HORA_RE = /^(\d{1,2}):(\d{2})/;
/** "7:05" y "07:05" son la misma hora. */
const horaNormalizada = (valor?: string | null) => {
  const m = String(valor ?? "").trim().match(HORA_RE);
  return m ? `${pad2(+m[1])}:${m[2]}` : "";
};

export const ZONA_EVENTO = "America/Santiago";

/** "HH:MM" de un instante, en la hora del evento. */
export const horaEvento = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", { timeZone: ZONA_EVENTO, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(d)
    .replace(/^24/, "00");
};

/** "YYYY-MM-DD" de un instante, en la hora del evento. */
export const diaEvento = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_EVENTO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
};

/** Lo que la comparación necesita saber de un viaje del sistema. */
export type ViajeComparable = {
  id: string;
  scheduledAt?: string | null;
  presentationAt?: string | null;
  legType?: string | null;
  vehiclePlate?: string | null;
  origin?: string | null;
  destination?: string | null;
  originVenueId?: string | null;
  originHotelId?: string | null;
  originFoodLocationId?: string | null;
  destinationVenueId?: string | null;
  destinationHotelId?: string | null;
  destinationFoodLocationId?: string | null;
  discipline?: string | null;
  passengerCount?: number | null;
  wheelchairCount?: number | null;
  driverId?: string | null;
  delegationId?: string | null;
  allDelegations?: boolean;
  tripType?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ContextoComparacion = {
  nombreDeLugar: (id: string) => string | null | undefined;
  nombreConductor: (id: string) => string | null | undefined;
  nombreRegion: (id: string) => string | null | undefined;
  /** Patente del vehículo asignado, cuando el viaje no la trae en texto. */
  patenteDeViaje?: (viaje: ViajeComparable) => string | null | undefined;
  anioPorDefecto: string;
};

export type Diferencia = { campo: string; planilla: string; sistema: string };

export type FilaComparada = {
  hoja: string;
  fila: number;
  /** "Bus 1 · Ida · Hotel X → Estadio Y" para leer el reporte sin abrir Excel. */
  descripcion: string;
  fecha: string | null;
  viajeId: string | null;
  diferencias: Diferencia[];
};

export type ResultadoComparacion = {
  filas: FilaComparada[];
  /** Viajes con al menos una diferencia, con sus diferencias. */
  porViaje: Map<string, Diferencia[]>;
  /** Filas de la planilla que no calzan con ningún viaje. */
  sinViaje: FilaComparada[];
  /** Viajes de esas fechas que ninguna fila nombra. */
  sinFila: ViajeComparable[];
  fechas: string[];
};

/** Tipo de viaje que la carga pone cuando la planilla no trae actividad. */
export const tipoDeViajeDeFila = (fila: ScheduleRow) =>
  fila.activity?.trim() || (tramoNormalizado(fila.legType) === "RETURN" ? "VIAJE_REGRESO" : "VIAJE_IDA");

/** Tipo de viaje efectivo de un viaje: el guardado o, si no hay, el del tramo. */
export const tipoDeViajeEfectivo = (viaje: { tripType?: string | null; legType?: string | null }) =>
  viaje.tripType?.trim() ||
  (viaje.legType ? (tramoNormalizado(viaje.legType) === "RETURN" ? "VIAJE_REGRESO" : "VIAJE_IDA") : "");

const uno = (a: string, b: string) => a === b || (a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a)));

/**
 * Cruza cada fila de la planilla con un viaje del sistema y anota en qué
 * difieren. El calce va por lo que identifica un servicio: fecha, tramo,
 * patente, origen y destino. Las horas no entran en el calce porque son
 * justamente lo que se revisa; si dos viajes del mismo vehículo repiten esa
 * clave, se toma el de hora más cercana.
 */
export function compararConPlanilla(
  filas: FilaPlanilla[],
  viajes: ViajeComparable[],
  ctx: ContextoComparacion,
): ResultadoComparacion {
  const nombre = (id?: string | null) => (id ? String(ctx.nombreDeLugar(id) ?? "").trim() : "");
  const lugares = (viaje: ViajeComparable, extremo: "origin" | "destination") => {
    const texto = extremo === "origin" ? viaje.origin : viaje.destination;
    const catalogo =
      extremo === "origin"
        ? nombre(viaje.originVenueId) || nombre(viaje.originHotelId) || nombre(viaje.originFoodLocationId)
        : nombre(viaje.destinationVenueId) || nombre(viaje.destinationHotelId) || nombre(viaje.destinationFoodLocationId);
    return [...new Set([claveTexto(texto), claveTexto(catalogo)].filter((v) => v.length > 0))];
  };
  const patente = (viaje: ViajeComparable) => claveTexto(viaje.vehiclePlate || ctx.patenteDeViaje?.(viaje) || "");

  // Índice: cada viaje bajo todas las claves con que una fila podría nombrarlo.
  const indice = new Map<string, ViajeComparable[]>();
  const fechaDe = new Map<string, string>();
  for (const viaje of viajes) {
    const fecha = diaEvento(viaje.scheduledAt);
    fechaDe.set(viaje.id, fecha);
    for (const origen of lugares(viaje, "origin")) {
      for (const destino of lugares(viaje, "destination")) {
        const clave = [fecha, tramoNormalizado(viaje.legType), patente(viaje), origen, destino].join("|");
        const lista = indice.get(clave) ?? [];
        lista.push(viaje);
        indice.set(clave, lista);
      }
    }
  }

  const usados = new Set<string>();
  const porViaje = new Map<string, Diferencia[]>();
  const fechas = new Set<string>();
  const filasComparadas: FilaComparada[] = filas.map((fila) => {
    const fecha = rowDateToIso(fila.date, ctx.anioPorDefecto);
    if (fecha) fechas.add(fecha);
    const descripcion = [
      fila.busNumber,
      fila.legType,
      `${fila.originName || fila.originAddress || "?"} → ${fila.destinationName || fila.destinationAddress || "?"}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const base: FilaComparada = { hoja: fila.hoja, fila: fila.fila, descripcion, fecha, viajeId: null, diferencias: [] };
    if (!fecha) return base;

    const clave = [
      fecha,
      tramoNormalizado(fila.legType),
      claveTexto(fila.vehiclePlate),
      claveTexto(fila.originName || fila.originAddress),
      claveTexto(fila.destinationName || fila.destinationAddress),
    ].join("|");
    const candidatos = (indice.get(clave) ?? []).filter((v) => !usados.has(v.id));
    if (candidatos.length === 0) return base;

    // Con varios candidatos, el de hora de viaje más cercana a la planilla.
    const objetivo = horaNormalizada(fila.departureTime) || horaNormalizada(fila.arrivalTime);
    const minutos = (hhmm: string) => (hhmm ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) : Number.NaN);
    const distancia = (v: ViajeComparable) => {
      const d = Math.abs(minutos(horaEvento(v.scheduledAt)) - minutos(objetivo));
      return Number.isNaN(d) ? Number.POSITIVE_INFINITY : d;
    };
    const viaje = [...candidatos].sort((a, b) => distancia(a) - distancia(b))[0];
    usados.add(viaje.id);

    const diferencias: Diferencia[] = [];
    const anotar = (campo: string, planilla: string, sistema: string, iguales: boolean) => {
      if (!iguales) diferencias.push({ campo, planilla: planilla || "—", sistema: sistema || "—" });
    };

    const presPlanilla = horaNormalizada(fila.presentationTime);
    const presSistema = horaEvento(viaje.presentationAt);
    anotar("Presentación conductor", presPlanilla, presSistema, presPlanilla === presSistema);

    // La hora del viaje es la del bus en el origen ("Hora Llegada Bus").
    const horaPlanilla = horaNormalizada(fila.departureTime);
    const horaSistema = horaEvento(viaje.scheduledAt);
    anotar("Hora del viaje", horaPlanilla, horaSistema, horaPlanilla === horaSistema);

    const discPlanilla = String(fila.discipline ?? "").trim();
    const discSistema = String(viaje.discipline ?? "").trim();
    anotar("Disciplina", discPlanilla, discSistema, uno(claveTexto(discPlanilla), claveTexto(discSistema)));

    const genPlanilla = generoNormalizado(fila.gender);
    const genSistema = generoNormalizado(typeof viaje.metadata?.gender === "string" ? viaje.metadata.gender : "");
    anotar("Género", genPlanilla, genSistema, genPlanilla === genSistema);

    const regionPlanilla = String(fila.delegation || fila.clientName || "").trim();
    const todasPlanilla = /todas/.test(claveRegion(regionPlanilla));
    const regionSistema = viaje.allDelegations
      ? "Todas las regiones"
      : viaje.delegationId
        ? String(ctx.nombreRegion(viaje.delegationId) ?? "").trim()
        : "";
    const regionesIguales = todasPlanilla
      ? Boolean(viaje.allDelegations)
      : uno(claveRegion(regionPlanilla), claveRegion(regionSistema));
    anotar("Región", regionPlanilla, regionSistema, regionesIguales);

    const paxPlanilla = fila.passengerCount ?? null;
    const paxSistema = viaje.passengerCount ?? null;
    anotar(
      "Pasajeros",
      paxPlanilla == null ? "" : String(paxPlanilla),
      paxSistema == null ? "" : String(paxSistema),
      (paxPlanilla ?? 0) === (paxSistema ?? 0),
    );

    const sillasPlanilla = fila.wheelchairCount ?? 0;
    const sillasSistema = viaje.wheelchairCount ?? 0;
    anotar("Sillas de ruedas", String(sillasPlanilla), String(sillasSistema), sillasPlanilla === sillasSistema);

    const condPlanilla = String(fila.driverName ?? "").trim();
    const condSistema = viaje.driverId ? String(ctx.nombreConductor(viaje.driverId) ?? "").trim() : "";
    anotar("Conductor", condPlanilla, condSistema, uno(claveTexto(condPlanilla), claveTexto(condSistema)));

    const tipoPlanilla = tipoDeViajeDeFila(fila);
    const tipoSistema = tipoDeViajeEfectivo(viaje);
    anotar("Tipo de viaje", tipoPlanilla, tipoSistema, claveTexto(tipoPlanilla) === claveTexto(tipoSistema));

    if (diferencias.length > 0) porViaje.set(viaje.id, diferencias);
    return { ...base, viajeId: viaje.id, diferencias };
  });

  const sinFila = viajes.filter((v) => !usados.has(v.id) && fechas.has(fechaDe.get(v.id) ?? ""));
  return {
    filas: filasComparadas,
    porViaje,
    sinViaje: filasComparadas.filter((f) => !f.viajeId),
    sinFila,
    fechas: [...fechas].sort(),
  };
}
