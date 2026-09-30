/**
 * Cobros de licitación de transporte (30-09-2026): lo que Seven cobra al
 * cliente por sistema, según el Plan de Operación (Rugby U20, Rev_01-sep).
 * Los traslados de aeropuerto se cobran por viaje; el resto, por vehículo y
 * día. Los cobros viven en el evento (config.cobrosTransporte) y cada uno
 * nombra a los proveedores que lo operan; acá se cruzan con los viajes para
 * medir el consumo que muestra el dashboard comercial.
 */
import { claveDiaEvento } from "@/lib/hora-evento";
import { tipoFlota } from "@/lib/flota-conductor";

export type ModalidadCobro = "POR_VIAJE" | "POR_VEHICULO_DIA";
export type FlotaCobro = "AUTO_SUV" | "VAN" | "BUS";

export type CobroTransporte = {
  id: string;
  sistema: string;
  modalidad: ModalidadCobro;
  flota: FlotaCobro;
  /** Valor unitario al cliente; llega en 0 a quien no tiene Finanzas. */
  clientPrice: number;
  cantidad: number;
  providerIds: string[];
  notas?: string | null;
};

export const MODALIDADES: { value: ModalidadCobro; label: string; unidad: string; unidades: string }[] = [
  { value: "POR_VIAJE", label: "Por viaje", unidad: "viaje", unidades: "viajes" },
  { value: "POR_VEHICULO_DIA", label: "Por vehículo y día", unidad: "vehículo-día", unidades: "vehículo-días" },
];

export const FLOTAS: { value: FlotaCobro; label: string }[] = [
  { value: "AUTO_SUV", label: "Auto / SUV" },
  { value: "VAN", label: "Van / Minibús" },
  { value: "BUS", label: "Bus" },
];

export const etiquetaModalidad = (m: ModalidadCobro) => MODALIDADES.find((x) => x.value === m)?.label ?? m;
export const unidadesDe = (m: ModalidadCobro) => MODALIDADES.find((x) => x.value === m)?.unidades ?? "";
export const etiquetaFlota = (f: FlotaCobro) => FLOTAS.find((x) => x.value === f)?.label ?? f;

/**
 * Clase de flota de un viaje según el vehículo pedido ("Sedán", "VAN_10",
 * "Bus"…). "Van" a secas, como viene en la planilla de Rugby, no es un tipo
 * de lib/flota-conductor (que pide VAN_10/15/19) pero sí es una van.
 */
export function claseFlota(vehiculo: unknown): FlotaCobro | null {
  const v = String(vehiculo ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  if (!v) return null;
  if (/^VAN\b|SPRINTER|MINIBUS|MINI BUS|MICRO/.test(v)) return "VAN";
  const tipo = tipoFlota(vehiculo);
  if (!tipo) return null;
  if (tipo === "SEDAN" || tipo === "SUV") return "AUTO_SUV";
  if (tipo === "BUS") return "BUS";
  return "VAN";
}

/** Traslados de aeropuerto: se cobran por viaje. */
export const esTransfer = (tripType: unknown) => /^TRANSFER/i.test(String(tripType ?? ""));

const REALIZADO = new Set(["COMPLETED", "DROPPED_OFF"]);

export type ViajeCobrable = {
  id: string;
  status?: string | null;
  tripType?: string | null;
  requestedVehicleType?: string | null;
  scheduledAt?: string | null;
  driverId?: string | null;
  eventId?: string | null;
};

export type Consumo = { programados: number; realizados: number };

/**
 * Consumo de cada cobro, por proveedor. Por viaje: los traslados de
 * aeropuerto de esos proveedores con esa clase de flota. Por vehículo-día:
 * los días distintos en que cada conductor de esos proveedores hizo algún
 * viaje que no fuera de aeropuerto (un bus con 4 traslados en el día es un
 * bus-día). "Realizado" es completado o pasajero dejado; lo cancelado no
 * cuenta.
 */
export function consumoDeCobros(
  cobros: CobroTransporte[],
  viajes: ViajeCobrable[],
  proveedorDe: (driverId: string) => string | null | undefined,
): Map<string, Map<string, Consumo>> {
  const resultado = new Map<string, Map<string, Consumo>>();
  const diasVistos = new Map<string, Set<string>>();
  const diasRealizados = new Map<string, Set<string>>();
  const anotar = (cobroId: string, providerId: string, campo: keyof Consumo) => {
    const porProveedor = resultado.get(cobroId) ?? new Map<string, Consumo>();
    const c = porProveedor.get(providerId) ?? { programados: 0, realizados: 0 };
    c[campo] += 1;
    porProveedor.set(providerId, c);
    resultado.set(cobroId, porProveedor);
  };
  for (const cobro of cobros) resultado.set(cobro.id, new Map());
  for (const v of viajes) {
    if (!v.driverId || v.status === "CANCELLED") continue;
    const proveedor = proveedorDe(v.driverId);
    if (!proveedor) continue;
    const clase = claseFlota(v.requestedVehicleType);
    if (!clase) continue;
    const transfer = esTransfer(v.tripType);
    const realizado = REALIZADO.has(String(v.status ?? ""));
    for (const cobro of cobros) {
      if (cobro.flota !== clase || !cobro.providerIds.includes(proveedor)) continue;
      if (cobro.modalidad === "POR_VIAJE") {
        if (!transfer) continue;
        anotar(cobro.id, proveedor, "programados");
        if (realizado) anotar(cobro.id, proveedor, "realizados");
      } else {
        if (transfer) continue;
        const dia = claveDiaEvento(v.scheduledAt);
        if (!dia) continue;
        const clave = `${cobro.id}|${proveedor}|${v.driverId}|${dia}`;
        const vistos = diasVistos.get(cobro.id) ?? new Set<string>();
        if (!vistos.has(clave)) {
          vistos.add(clave);
          diasVistos.set(cobro.id, vistos);
          anotar(cobro.id, proveedor, "programados");
        }
        if (realizado) {
          const hechos = diasRealizados.get(cobro.id) ?? new Set<string>();
          if (!hechos.has(clave)) {
            hechos.add(clave);
            diasRealizados.set(cobro.id, hechos);
            anotar(cobro.id, proveedor, "realizados");
          }
        }
      }
    }
  }
  return resultado;
}

/** Suma del consumo de un cobro entre todos sus proveedores. */
export function consumoTotal(porProveedor: Map<string, Consumo> | undefined): Consumo {
  let programados = 0;
  let realizados = 0;
  for (const c of porProveedor?.values() ?? []) {
    programados += c.programados;
    realizados += c.realizados;
  }
  return { programados, realizados };
}

export type ResumenCobro = CobroTransporte & {
  licitado: number;
  programados: number;
  realizados: number;
  consumido: number;
  programado: number;
  avance: number;
};

export type ResumenProveedor = {
  providerId: string;
  /** Cobros que sólo opera este proveedor. */
  licitadoExclusivo: number;
  /** Cobros que comparte con otros (el total del cobro, no una parte). */
  licitadoCompartido: number;
  consumido: number;
  programado: number;
  realizados: number;
  programados: number;
  cobroIds: string[];
};

export type ResumenLicitacion = {
  licitado: number;
  consumido: number;
  programado: number;
  porFacturar: number;
  avance: number;
  cobros: ResumenCobro[];
  porSistema: { sistema: string; licitado: number; consumido: number }[];
  porProveedor: ResumenProveedor[];
};

const pct = (parte: number, todo: number) => (todo > 0 ? Math.min(100, Math.round((parte / todo) * 100)) : 0);

/** Todo lo que pinta el dashboard, a partir de los cobros y su consumo. */
export function resumenLicitacion(cobros: CobroTransporte[], consumo: Map<string, Map<string, Consumo>>): ResumenLicitacion {
  const detalle: ResumenCobro[] = cobros.map((c) => {
    const total = consumoTotal(consumo.get(c.id));
    const licitado = c.clientPrice * c.cantidad;
    return {
      ...c,
      licitado,
      programados: total.programados,
      realizados: total.realizados,
      consumido: total.realizados * c.clientPrice,
      programado: total.programados * c.clientPrice,
      avance: pct(total.realizados, c.cantidad),
    };
  });
  const licitado = detalle.reduce((s, c) => s + c.licitado, 0);
  const consumido = detalle.reduce((s, c) => s + c.consumido, 0);
  const programado = detalle.reduce((s, c) => s + c.programado, 0);

  const sistemas = new Map<string, { licitado: number; consumido: number }>();
  for (const c of detalle) {
    const s = sistemas.get(c.sistema) ?? { licitado: 0, consumido: 0 };
    s.licitado += c.licitado;
    s.consumido += c.consumido;
    sistemas.set(c.sistema, s);
  }

  const proveedores = new Map<string, ResumenProveedor>();
  for (const c of detalle) {
    for (const providerId of c.providerIds) {
      const p = proveedores.get(providerId) ?? {
        providerId, licitadoExclusivo: 0, licitadoCompartido: 0, consumido: 0, programado: 0, realizados: 0, programados: 0, cobroIds: [],
      };
      if (c.providerIds.length === 1) p.licitadoExclusivo += c.licitado;
      else p.licitadoCompartido += c.licitado;
      const propio = consumo.get(c.id)?.get(providerId) ?? { programados: 0, realizados: 0 };
      p.consumido += propio.realizados * c.clientPrice;
      p.programado += propio.programados * c.clientPrice;
      p.realizados += propio.realizados;
      p.programados += propio.programados;
      p.cobroIds.push(c.id);
      proveedores.set(providerId, p);
    }
  }

  return {
    licitado,
    consumido,
    programado,
    porFacturar: Math.max(0, licitado - consumido),
    avance: pct(consumido, licitado),
    cobros: detalle,
    porSistema: [...sistemas.entries()].map(([sistema, v]) => ({ sistema, ...v })).sort((a, b) => b.licitado - a.licitado),
    porProveedor: [...proveedores.values()].sort((a, b) => b.consumido - a.consumido || b.licitadoExclusivo - a.licitadoExclusivo),
  };
}

export const pesos = (v: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v || 0);

/** "$28,0 M" para los rótulos de los gráficos. */
export function pesosCortos(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `$${Math.round(v / 1_000).toLocaleString("es-CL")} k`;
  return pesos(v);
}

/**
 * Plantilla del Plan de Operación Rugby U20 (Rev_01-sep) para el editor:
 * los ocho cobros del plan sin proveedores asignados.
 */
export const PLANTILLA_RUGBY_U20: Omit<CobroTransporte, "id">[] = [
  { sistema: "Aeropuerto · auto/SUV (hasta 3 pax)", modalidad: "POR_VIAJE", flota: "AUTO_SUV", clientPrice: 180000, cantidad: 17, providerIds: [] },
  { sistema: "Aeropuerto · van/minibús (4 a 12 pax)", modalidad: "POR_VIAJE", flota: "VAN", clientPrice: 250000, cantidad: 10, providerIds: [] },
  { sistema: "Aeropuerto · bus delegaciones", modalidad: "POR_VIAJE", flota: "BUS", clientPrice: 300000, cantidad: 16, providerIds: [] },
  { sistema: "Bus dedicado delegaciones (TA), 16 h", modalidad: "POR_VEHICULO_DIA", flota: "BUS", clientPrice: 444500, cantidad: 63, providerIds: [] },
  { sistema: "Vans 7 pax delegaciones (TA), 16 h", modalidad: "POR_VEHICULO_DIA", flota: "VAN", clientPrice: 149500, cantidad: 38, providerIds: [] },
  { sistema: "Van oficiales técnicos (TF), 16 h", modalidad: "POR_VEHICULO_DIA", flota: "VAN", clientPrice: 149500, cantidad: 19, providerIds: [] },
  { sistema: "Van staff WR, 16 h", modalidad: "POR_VEHICULO_DIA", flota: "VAN", clientPrice: 249500, cantidad: 19, providerIds: [] },
  { sistema: "Auto presidentes e invitados WR, 16 h", modalidad: "POR_VEHICULO_DIA", flota: "AUTO_SUV", clientPrice: 149500, cantidad: 9, providerIds: [] },
];
