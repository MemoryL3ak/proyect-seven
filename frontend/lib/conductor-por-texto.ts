import { conductorEnEvento, type ConEventos } from "./conductores-del-evento";

/**
 * Conductor escrito en la carga masiva de AND (columnas "conductor_llegada" y
 * "conductor_salida" de la planilla, o "Conductor llegada/salida" agregadas al
 * itinerario oficial). 28-09-2026: la carga traía los vuelos pero no el
 * chofer, y los traslados quedaban sin asignar.
 *
 * Se acepta el nombre, el RUT o el teléfono, y sólo entre los conductores de
 * los proveedores del evento. Si no calza o calza con varios, se dice en la
 * validación en vez de adivinar.
 */
export type ConductorBuscable = ConEventos & {
  id: string;
  fullName?: string | null;
  rut?: string | null;
  phone?: string | null;
  /** vehiclePatente del conductor de proveedor. */
  metadata?: Record<string, unknown> | null;
};

export type ResultadoConductor = { id: string; nombre: string } | { error: string } | null;

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const soloRut = (s: string) => s.replace(/[^0-9kK]/g, "").toUpperCase();
const soloDigitos = (s: string) => s.replace(/\D/g, "");

/** Celda vacía o con "0", "-", "sin", "no": no hay conductor (no es error). */
export const sinConductor = (texto: unknown) => {
  const v = normal(String(texto ?? ""));
  return !v || ["0", "sin", "no", "sin conductor", "n a", "na"].includes(v);
};

export function conductorPorTexto(
  texto: unknown,
  conductores: ConductorBuscable[],
  eventoId: string | null | undefined,
): ResultadoConductor {
  if (sinConductor(texto)) return null;
  const valor = String(texto).trim();
  const delEvento = conductores.filter((c) => conductorEnEvento(c, eventoId));
  const nombre = (c: ConductorBuscable) => String(c.fullName ?? "").trim() || c.id;
  const uno = (lista: ConductorBuscable[]) => ({ id: lista[0].id, nombre: nombre(lista[0]) });
  const varios = (lista: ConductorBuscable[]) => ({
    error: `"${valor}" calza con varios conductores: ${lista.slice(0, 4).map(nombre).join(", ")}`,
  });

  // RUT (con o sin puntos y guion).
  const rut = soloRut(valor);
  if (/\d/.test(valor) && rut.length >= 7 && /^[0-9.\-\skK]+$/.test(valor)) {
    const porRut = delEvento.filter((c) => c.rut && soloRut(c.rut) === rut);
    if (porRut.length === 1) return uno(porRut);
    if (porRut.length > 1) return varios(porRut);
  }
  // Teléfono: se comparan los últimos 8 dígitos (+56 9 ... o 9 ...).
  const digitos = soloDigitos(valor);
  if (digitos.length >= 8 && /^[+0-9\s().-]+$/.test(valor)) {
    const cola = digitos.slice(-8);
    const porFono = delEvento.filter((c) => c.phone && soloDigitos(c.phone).slice(-8) === cola);
    if (porFono.length === 1) return uno(porFono);
    if (porFono.length > 1) return varios(porFono);
  }

  // Nombre exacto (sin tildes ni mayúsculas).
  const buscado = normal(valor);
  const exactos = delEvento.filter((c) => normal(nombre(c)) === buscado);
  if (exactos.length === 1) return uno(exactos);
  if (exactos.length > 1) return varios(exactos);

  // Nombre por palabras: "Héctor Silva" encuentra a "Héctor Silva Castillo".
  const palabras = buscado.split(" ").filter((p) => p.length > 1);
  if (palabras.length) {
    const parciales = delEvento.filter((c) => {
      const n = ` ${normal(nombre(c))} `;
      return palabras.every((p) => n.includes(` ${p} `));
    });
    if (parciales.length === 1) return uno(parciales);
    if (parciales.length > 1) return varios(parciales);
  }

  return { error: `"${valor}" no es conductor de un proveedor de este evento` };
}

/**
 * Columnas de conductor en el itinerario oficial de AND (formato de columnas
 * fijas): se buscan por su título en las dos primeras filas. "Conductor
 * llegada" / "Chofer salida"; un "Conductor" sin sentido vale para los dos.
 */
export function columnasConductor(filas: unknown[][]): { llegada: number | null; salida: number | null } {
  let llegada: number | null = null;
  let salida: number | null = null;
  let general: number | null = null;
  for (const fila of filas.slice(0, 2)) {
    (fila ?? []).forEach((celda, i) => {
      const t = normal(String(celda ?? ""));
      if (!/\b(conductor|chofer)\b/.test(t)) return;
      if (/\b(llegada|arribo|in)\b/.test(t)) llegada = llegada ?? i;
      else if (/\b(salida|out)\b/.test(t)) salida = salida ?? i;
      else general = general ?? i;
    });
  }
  return { llegada: llegada ?? general, salida: salida ?? general };
}

/** "ab-cd 12" → "ABCD12". */
export const patenteNormal = (texto: unknown) =>
  String(texto ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/**
 * Conductor de un tramo con las cuatro columnas de la plantilla de AND
 * (28-09-2026: Ariel pidió conductor, teléfono, patente y tipo de flota en la
 * plantilla, no sólo en la planilla que se descarga). Manda el nombre; el
 * teléfono y la patente lo encuentran cuando el nombre falta, no calza o calza
 * con varios, y avisan si apuntan a otro conductor.
 */
export function conductorDelTramo(
  celdas: { conductor?: unknown; telefono?: unknown; patente?: unknown },
  conductores: ConductorBuscable[],
  eventoId: string | null | undefined,
): ResultadoConductor {
  const porNombre = conductorPorTexto(celdas.conductor, conductores, eventoId);
  const telefono = String(celdas.telefono ?? "").trim();
  const patente = patenteNormal(celdas.patente);
  const delEvento = conductores.filter((c) => conductorEnEvento(c, eventoId));
  const nombre = (c: ConductorBuscable) => String(c.fullName ?? "").trim() || c.id;

  const porTelefono = (() => {
    const cola = soloDigitos(telefono).slice(-8);
    if (cola.length < 8) return [];
    return delEvento.filter((c) => c.phone && soloDigitos(c.phone).slice(-8) === cola);
  })();
  const porPatente = patente
    ? delEvento.filter((c) => patenteNormal(c.metadata?.vehiclePatente) === patente)
    : [];

  if (porNombre && "id" in porNombre) {
    const otro = [...porTelefono, ...porPatente].find((c) => c.id !== porNombre.id);
    const suyo = [...porTelefono, ...porPatente].some((c) => c.id === porNombre.id);
    if (otro && !suyo) {
      return { error: `"${String(celdas.conductor).trim()}" no calza con el teléfono o la patente, que son de ${nombre(otro)}` };
    }
    return porNombre;
  }

  // Sin nombre, o el nombre no alcanza: el teléfono y la patente deciden.
  for (const lista of [porTelefono, porPatente]) {
    if (lista.length === 1) return { id: lista[0].id, nombre: nombre(lista[0]) };
  }
  const ambos = porTelefono.filter((c) => porPatente.some((p) => p.id === c.id));
  if (ambos.length === 1) return { id: ambos[0].id, nombre: nombre(ambos[0]) };

  if (porNombre) return porNombre;
  if (telefono || patente) {
    const que = [telefono && `el teléfono ${telefono}`, patente && `la patente ${patente}`].filter(Boolean).join(" ni ");
    if (porTelefono.length > 1 || porPatente.length > 1) return { error: `Hay varios conductores con ${que}: escribe el nombre` };
    return { error: `No hay conductor de un proveedor de este evento con ${que}` };
  }
  return null;
}

const FLOTA_POR_TEXTO: Record<string, string> = {
  sedan: "Sedán",
  auto: "Sedán",
  suv: "SUV",
  van: "Van",
  "van 10": "Van 10",
  "van 15": "Van 15-17",
  "van 15 17": "Van 15-17",
  "van 19": "Van 19",
  minibus: "Minibus",
  "mini bus": "Minibus",
  bus: "Bus",
};

/**
 * Tipo de flota de la plantilla, con el nombre que usa Viajes ("VAN_15",
 * "van 15-17" → "Van 15-17"). Lo que no se reconoce se guarda como vino:
 * el vehículo pedido de un viaje es texto libre ("Bus 40 pax").
 */
export function flotaDeTexto(texto: unknown): string | null {
  const crudo = String(texto ?? "").trim();
  if (!crudo || sinConductor(crudo)) return null;
  const clave = normal(crudo.replace(/_/g, " "));
  return FLOTA_POR_TEXTO[clave] ?? crudo;
}

/**
 * Columnas de teléfono del conductor, patente y tipo de flota agregadas al
 * itinerario oficial de AND, por su título en las dos primeras filas. El
 * teléfono sólo si el título dice conductor o chofer: "Teléfono" solo es el
 * del pasajero.
 */
export function columnasExtraTraslado(filas: unknown[][]) {
  const vacio = () => ({ llegada: null as number | null, salida: null as number | null, general: null as number | null });
  const cols = { telefono: vacio(), patente: vacio(), flota: vacio() };
  for (const fila of filas.slice(0, 2)) {
    (fila ?? []).forEach((celda, i) => {
      const t = normal(String(celda ?? ""));
      const campo = /\b(telefono|fono|celular)\b/.test(t) && /\b(conductor|chofer)\b/.test(t)
        ? cols.telefono
        : /\bpatente\b/.test(t)
          ? cols.patente
          : /\b(flota|tipo de vehiculo)\b/.test(t)
            ? cols.flota
            : null;
      if (!campo) return;
      if (/\b(llegada|arribo|in)\b/.test(t)) campo.llegada = campo.llegada ?? i;
      else if (/\b(salida|out)\b/.test(t)) campo.salida = campo.salida ?? i;
      else campo.general = campo.general ?? i;
    });
  }
  const sentido = (c: ReturnType<typeof vacio>) => ({ llegada: c.llegada ?? c.general, salida: c.salida ?? c.general });
  return { telefono: sentido(cols.telefono), patente: sentido(cols.patente), flota: sentido(cols.flota) };
}
