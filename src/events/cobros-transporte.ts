/**
 * Cobros de licitación de transporte de un evento (30-09-2026).
 *
 * El Plan de Operación de Rugby U20 (Rev_01-sep) cobra por sistema: los
 * traslados de aeropuerto por viaje (auto $180.000, van $250.000, bus
 * $300.000) y el resto por vehículo y día (bus dedicado $444.500, vans
 * $149.500 o $249.500). El sistema valoriza por viaje, así que estos cobros
 * viven aparte, en core.events.config.cobrosTransporte, y cada uno nombra a
 * los proveedores que lo operan: el dashboard comercial cruza los cobros con
 * los viajes de esos proveedores para medir el consumo.
 *
 * El valor unitario va en `clientPrice` a propósito: es lo que Seven cobra al
 * cliente y el interceptor de campos sensibles lo oculta a quien no tiene el
 * módulo Finanzas (CAMPOS_DE_COBRO).
 */
export const MODALIDADES_COBRO = ['POR_VIAJE', 'POR_VEHICULO_DIA'] as const;
export type ModalidadCobro = (typeof MODALIDADES_COBRO)[number];

export const FLOTAS_COBRO = ['AUTO_SUV', 'VAN', 'BUS'] as const;
export type FlotaCobro = (typeof FLOTAS_COBRO)[number];

export type CobroTransporte = {
  id: string;
  sistema: string;
  modalidad: ModalidadCobro;
  flota: FlotaCobro;
  /** Valor unitario que se cobra al cliente (por viaje o por vehículo-día). */
  clientPrice: number;
  /** Cantidad licitada: viajes o vehículo-días. */
  cantidad: number;
  /** Proveedores que operan este cobro. */
  providerIds: string[];
  notas?: string | null;
};

export const CLAVE_CONFIG = 'cobrosTransporte';

const texto = (v: unknown) => String(v ?? '').trim();
const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Id estable para un cobro nuevo (no se apoya en crypto para poder probarlo). */
export function idDeCobro(indice: number, ahora = Date.now()): string {
  return `cobro-${ahora.toString(36)}-${indice}`;
}

/**
 * Deja la lista limpia: ids para los cobros nuevos, textos recortados,
 * números válidos, modalidad y flota reconocidas, proveedores sin repetir.
 * Lo que no tiene sistema se descarta (una fila vacía del editor).
 */
export function normalizarCobros(entrada: unknown, ahora = Date.now()): CobroTransporte[] {
  if (!Array.isArray(entrada)) return [];
  const salida: CobroTransporte[] = [];
  entrada.forEach((item, i) => {
    const c = (item ?? {}) as Record<string, unknown>;
    const sistema = texto(c.sistema);
    if (!sistema) return;
    const modalidad = (MODALIDADES_COBRO as readonly string[]).includes(String(c.modalidad))
      ? (c.modalidad as ModalidadCobro)
      : 'POR_VIAJE';
    const flota = (FLOTAS_COBRO as readonly string[]).includes(String(c.flota)) ? (c.flota as FlotaCobro) : 'VAN';
    const providerIds = Array.from(
      new Set((Array.isArray(c.providerIds) ? c.providerIds : []).map((p) => texto(p)).filter(Boolean)),
    );
    salida.push({
      id: texto(c.id) || idDeCobro(i, ahora),
      sistema,
      modalidad,
      flota,
      clientPrice: Math.round(numero(c.clientPrice)),
      cantidad: Math.round(numero(c.cantidad)),
      providerIds,
      notas: texto(c.notas) || null,
    });
  });
  return salida;
}

/** Cobros guardados en la configuración del evento. */
export function cobrosDeConfig(config: unknown): CobroTransporte[] {
  const c = (config ?? {}) as Record<string, unknown>;
  return normalizarCobros(c[CLAVE_CONFIG]);
}

/** La configuración del evento con los cobros reemplazados; lo demás se conserva. */
export function configConCobros(config: unknown, cobros: CobroTransporte[]): Record<string, unknown> {
  const base = config && typeof config === 'object' && !Array.isArray(config) ? (config as Record<string, unknown>) : {};
  return { ...base, [CLAVE_CONFIG]: cobros };
}

/** Total licitado: Σ valor × cantidad. */
export function totalLicitado(cobros: CobroTransporte[]): number {
  return cobros.reduce((s, c) => s + c.clientPrice * c.cantidad, 0);
}
