import { TIPO_VEHICULO } from "./export-conductores";
import { nombrePropio } from "./nombres";

/**
 * Directorio de conductores del Coordinador de Transporte (app): todos los
 * choferes de la plataforma con su ficha, su vehículo, su proveedor, si
 * están en línea y los botones para llamar o escribirles por WhatsApp.
 * Pedido de Ariel del 24-09-2026.
 */
export type ConductorDirectorio = {
  id: string;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  rut?: string | null;
  photoUrl?: string | null;
  providerId?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PresenciaConductor = {
  driverId: string;
  online: boolean;
  secondsSinceSeen: number | null;
  activeTrips: number;
  dayTripCount: number;
  activeTripStatus: string | null;
};

export type Vehiculo = {
  tipo: string | null;
  patente: string | null;
  marcaModelo: string | null;
  capacidad: number | null;
};

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** Vehículo escrito en la ficha del conductor (metadata vehicle*). */
export function vehiculoDe(metadata?: Record<string, unknown> | null): Vehiculo {
  const meta = metadata ?? {};
  const tipoCrudo = texto(meta.vehicleTipo).toUpperCase();
  const tipo = tipoCrudo ? (TIPO_VEHICULO[tipoCrudo] ?? tipoCrudo) : null;
  const patente = texto(meta.vehiclePatente).toUpperCase() || null;
  const marcaModelo = [texto(meta.vehicleMarca), texto(meta.vehicleModelo), texto(meta.vehicleAno)].filter(Boolean).join(" ") || null;
  const capacidadNum = Number(texto(meta.vehicleCapacity));
  const capacidad = Number.isFinite(capacidadNum) && capacidadNum > 0 ? capacidadNum : null;
  return { tipo, patente, marcaModelo, capacidad };
}

/** "Van 15-17 · ABCD12 · Toyota Hiace 2022 · 15 pax", o "" si no hay nada. */
export function describirVehiculo(v: Vehiculo): string {
  return [v.tipo, v.patente, v.marcaModelo, v.capacidad ? `${v.capacidad} pax` : null].filter(Boolean).join(" · ");
}

export type EstadoConductor = "EN_VIAJE" | "EN_LINEA" | "SIN_SENAL" | "DESCONECTADO";

/** Qué está haciendo ahora, según la presencia (o desconectado si no hay dato). */
export function estadoDe(p: PresenciaConductor | undefined): EstadoConductor {
  if (!p) return "DESCONECTADO";
  if (p.activeTrips > 0) return "EN_VIAJE";
  if (p.online) return "EN_LINEA";
  if (p.secondsSinceSeen != null && p.secondsSinceSeen <= 10 * 60) return "SIN_SENAL";
  return "DESCONECTADO";
}

export const ESTADO_CONDUCTOR_LABEL: Record<EstadoConductor, string> = {
  EN_VIAJE: "En viaje",
  EN_LINEA: "En línea",
  SIN_SENAL: "Sin señal",
  DESCONECTADO: "Desconectado",
};

const clave = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export type FiltroDirectorio = {
  busqueda: string;
  proveedorId: string;
  /** "" = todos, o un EstadoConductor. */
  estado: "" | EstadoConductor;
};

export function coincideBusqueda(c: ConductorDirectorio, busqueda: string): boolean {
  const q = clave(busqueda);
  if (!q) return true;
  const v = vehiculoDe(c.metadata);
  const campos = [c.fullName, c.phone, c.rut, c.email, v.patente, v.marcaModelo, v.tipo].map((x) => clave(String(x ?? "")));
  return campos.some((campo) => campo.includes(q));
}

/**
 * Filtra y ordena: primero los que van en viaje, después en línea, después
 * el resto; dentro de cada grupo por nombre. Es el orden en que el
 * coordinador los necesita: al que está manejando se le llama primero.
 */
export function filtrarConductores<T extends ConductorDirectorio>(
  lista: readonly T[],
  presencia: ReadonlyMap<string, PresenciaConductor>,
  filtro: FiltroDirectorio,
): T[] {
  const orden: Record<EstadoConductor, number> = { EN_VIAJE: 0, EN_LINEA: 1, SIN_SENAL: 2, DESCONECTADO: 3 };
  return lista
    .filter((c) => String(c.status ?? "").toUpperCase() !== "DELETED")
    .filter((c) => !filtro.proveedorId || c.providerId === filtro.proveedorId)
    .filter((c) => !filtro.estado || estadoDe(presencia.get(c.id)) === filtro.estado)
    .filter((c) => coincideBusqueda(c, filtro.busqueda))
    .sort((a, b) => {
      const ea = estadoDe(presencia.get(a.id));
      const eb = estadoDe(presencia.get(b.id));
      return orden[ea] - orden[eb] || nombrePropio(a.fullName).localeCompare(nombrePropio(b.fullName), "es");
    });
}

/** Iniciales para el avatar cuando no hay foto. */
export function inicialesDe(nombre?: string | null): string {
  return nombrePropio(nombre)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

/** Mensaje inicial del WhatsApp: el chofer sabe quién le escribe y por qué. */
export function saludoWhatsapp(nombreChofer?: string | null, nombreCoordinador?: string | null): string {
  const chofer = nombrePropio(nombreChofer).split(" ")[0];
  const saludo = chofer ? `Hola ${chofer}` : "Hola";
  const quien = nombrePropio(nombreCoordinador);
  return quien
    ? `${saludo}, te escribe ${quien} de la coordinación de transporte.`
    : `${saludo}, te escribe la coordinación de transporte.`;
}
