import { downloadExcel } from "@/lib/reports";
import { nombrePropio } from "@/lib/nombres";

/**
 * Planilla de conductores.
 *
 * Los conductores viven como participantes de proveedor y su vehículo va en la
 * metadata de la ficha, así que hasta ahora la única forma de ver la nómina
 * completa era abrir una por una. Esto arma la planilla con todo lo de la
 * persona, su vehículo y el proveedor que la aporta.
 */

export type ConductorExportable = {
  id: string;
  providerId?: string | null;
  fullName?: string | null;
  rut?: string | null;
  email?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  passportNumber?: string | null;
  dateOfBirth?: string | null;
  userType?: string | null;
  status?: string | null;
  observations?: string | null;
  delegationId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ProveedorExportable = {
  id: string;
  name?: string | null;
  type?: string | null;
  subtype?: string | null;
  rut?: string | null;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
};

export const TIPO_VEHICULO: Record<string, string> = {
  SEDAN: "Sedán",
  SUV: "SUV",
  VAN_10: "Van 10",
  VAN_15: "Van 15-17",
  VAN_19: "Van 19",
  MINIBUS: "Minibús",
  BUS: "Bus",
  M1: "M1 · Van",
  M4: "M4 · Bus",
  M5: "M5 · Van adaptada",
};

const texto = (valor: unknown): string => {
  if (valor === null || valor === undefined) return "";
  if (Array.isArray(valor)) return valor.map((v) => String(v)).join(", ");
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  return String(valor);
};

const fecha = (valor?: string | null): string => {
  if (!valor) return "";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? String(valor) : d.toLocaleDateString("es-CL");
};

/** Código con el que el conductor entra a la app: los últimos 6 de su id. */
const codigoAcceso = (id: string) => String(id).slice(-6).toLowerCase();

export const ES_CONDUCTOR = (p: ConductorExportable): boolean => {
  const meta = p.metadata ?? {};
  if (meta.isDriver === true || meta.isDriver === "true") return true;
  // Fichas antiguas: el rol venía escrito en user_type, con mayúsculas y
  // minúsculas mezcladas ("conductor", "CONDUCTOR", "Conductor").
  return String(p.userType ?? "").trim().toLowerCase() === "conductor";
};

const ENCABEZADOS = [
  "Nombre completo",
  "RUT",
  "Email",
  "Teléfono",
  "País",
  "Pasaporte",
  "Fecha de nacimiento",
  "Estado",
  "Código app",
  "Proveedor",
  "Tipo de proveedor",
  "Subtipo",
  "RUT proveedor",
  "Contacto proveedor",
  "Teléfono proveedor",
  "Vehículo",
  "Patente",
  "Marca",
  "Modelo",
  "Año",
  "Capacidad",
  "Tipos de cliente",
  "Observaciones",
];

function fila(
  conductor: ConductorExportable,
  proveedor: ProveedorExportable | undefined,
): string[] {
  const meta = conductor.metadata ?? {};
  const tipoVehiculo = texto(meta.vehicleTipo).toUpperCase();
  return [
    nombrePropio(conductor.fullName),
    texto(conductor.rut),
    texto(conductor.email),
    texto(conductor.phone),
    texto(conductor.countryCode),
    texto(conductor.passportNumber),
    fecha(conductor.dateOfBirth),
    texto(conductor.status),
    codigoAcceso(conductor.id),
    texto(proveedor?.name),
    texto(proveedor?.type),
    texto(proveedor?.subtype),
    texto(proveedor?.rut),
    nombrePropio(proveedor?.contactName),
    texto(proveedor?.phone),
    TIPO_VEHICULO[tipoVehiculo] ?? tipoVehiculo,
    texto(meta.vehiclePatente).toUpperCase(),
    texto(meta.vehicleMarca),
    texto(meta.vehicleModelo),
    texto(meta.vehicleAno),
    texto(meta.vehicleCapacity),
    texto(meta.allowedClientTypes),
    texto(conductor.observations),
  ];
}

/**
 * Descarga la planilla. `proveedorUnico` sólo cambia el nombre del archivo y
 * el título de la hoja: el filtrado lo decide quien llama, que es el que sabe
 * qué está mirando en pantalla.
 */
export function descargarConductores(
  conductores: ConductorExportable[],
  proveedores: ProveedorExportable[],
  proveedorUnico?: ProveedorExportable | null,
): void {
  const porId = new Map(proveedores.map((p) => [p.id, p]));
  const filas = conductores
    .filter(ES_CONDUCTOR)
    .sort((a, b) => nombrePropio(a.fullName).localeCompare(nombrePropio(b.fullName), "es"))
    .map((c) => fila(c, c.providerId ? porId.get(c.providerId) : undefined));

  const sufijo = proveedorUnico?.name
    ? proveedorUnico.name.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40)
    : "todos";

  downloadExcel(`conductores_${sufijo}`, [
    {
      title: proveedorUnico?.name ? proveedorUnico.name.slice(0, 31) : "Conductores",
      headers: ENCABEZADOS,
      rows: filas,
    },
  ]);
}
