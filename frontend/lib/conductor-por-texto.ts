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
