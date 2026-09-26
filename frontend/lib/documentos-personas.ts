import { ES_CONDUCTOR } from "./export-conductores";

/**
 * Documentación que sube cada persona de un proveedor (Registro → Proveedores
 * → Participantes; los conductores son participantes de proveedores de
 * transporte). Los archivos quedan como URL en la metadata de la ficha,
 * bajo las claves `doc_*`; no hay tabla de documentos.
 *
 * Pedido de Ariel del 23-09-2026: identificar quién no ha subido documentos,
 * con filtros por tipo de persona (conductor u otro) y por estado de su
 * documentación, tanto en el módulo Documentos como en el listado de
 * participantes de proveedores.
 */
export type DocumentoRequerido = { key: string; label: string };

export const DOCS_PERSONA: DocumentoRequerido[] = [
  { key: "doc_carnet", label: "Fotocopia Carnet" },
  { key: "doc_antecedentes", label: "Antecedentes" },
  { key: "doc_inhabilidades", label: "Cert. Inhabilidades menores" },
  { key: "doc_licencia", label: "Licencia de conducir" },
  { key: "doc_foto_carnet", label: "Foto tipo Carnet" },
];

export const DOCS_VEHICULO: DocumentoRequerido[] = [
  { key: "doc_permiso_circ", label: "Permiso de circulación" },
  { key: "doc_soap", label: "SOAP" },
  { key: "doc_decreto_80", label: "Decreto 80" },
  { key: "doc_gases", label: "Gases" },
  { key: "doc_padron", label: "Padrón" },
  { key: "doc_seguro_adicional", label: "Seguros adicionales" },
  { key: "doc_foto_vehiculo", label: "Foto del vehículo" },
];

export const DOCS_CONDUCTOR: DocumentoRequerido[] = [...DOCS_PERSONA, ...DOCS_VEHICULO];

export type PersonaConDocumentos = {
  userType?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type TipoPersona = "CONDUCTOR" | "OTRO";

/** Conductor por su ficha (isDriver o el rol escrito, con sus erratas). */
export const tipoDePersona = (p: PersonaConDocumentos): TipoPersona =>
  ES_CONDUCTOR({ id: "", userType: p.userType, metadata: p.metadata }) ? "CONDUCTOR" : "OTRO";

export const TIPO_PERSONA_LABEL: Record<TipoPersona, string> = {
  CONDUCTOR: "Conductor",
  OTRO: "Otro participante",
};

/**
 * Qué debe subir cada persona. Sólo los proveedores de transporte suben
 * documentación por esta vía: al conductor se le piden los suyos y los del
 * vehículo; al resto del personal de transporte, sólo los personales.
 */
export function documentosRequeridos(p: PersonaConDocumentos, tipoProveedor?: string | null): DocumentoRequerido[] {
  if (String(tipoProveedor ?? "").toUpperCase() !== "TRANSPORTE") return [];
  return tipoDePersona(p) === "CONDUCTOR" ? DOCS_CONDUCTOR : DOCS_PERSONA;
}

export type EstadoDocumentacion = "SIN_DOCUMENTOS" | "INCOMPLETA" | "COMPLETA" | "NO_APLICA";

export const ESTADO_DOCUMENTACION_LABEL: Record<EstadoDocumentacion, string> = {
  SIN_DOCUMENTOS: "Sin documentos",
  INCOMPLETA: "Incompleta",
  COMPLETA: "Completa",
  NO_APLICA: "No aplica",
};

export type Documentacion = {
  requeridos: DocumentoRequerido[];
  subidos: DocumentoRequerido[];
  faltantes: DocumentoRequerido[];
  estado: EstadoDocumentacion;
  /** Fecha de la última subida, deducida del nombre del archivo; null si no hay. */
  ultimaSubida: Date | null;
};

const urlDe = (metadata: Record<string, unknown> | null | undefined, key: string): string | null => {
  const v = metadata?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
};

/**
 * El archivo se guarda como `<id>/<clave>-<milisegundos>.<ext>`, así que la
 * fecha de subida se lee del nombre. Una URL con otro formato no tiene fecha.
 */
export function fechaDeDocumento(url: string): Date | null {
  const m = url.match(/doc_[a-z0-9_]+-(\d{13})\.[a-z0-9]+(?:\?.*)?$/i);
  if (!m) return null;
  const d = new Date(Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function documentacionDe(p: PersonaConDocumentos, tipoProveedor?: string | null): Documentacion {
  const requeridos = documentosRequeridos(p, tipoProveedor);
  const subidos = requeridos.filter((d) => urlDe(p.metadata, d.key));
  const faltantes = requeridos.filter((d) => !urlDe(p.metadata, d.key));
  const fechas = subidos
    .map((d) => fechaDeDocumento(urlDe(p.metadata, d.key) as string))
    .filter((f): f is Date => f !== null);
  const ultimaSubida = fechas.length ? new Date(Math.max(...fechas.map((f) => f.getTime()))) : null;
  const estado: EstadoDocumentacion =
    requeridos.length === 0 ? "NO_APLICA"
    : subidos.length === 0 ? "SIN_DOCUMENTOS"
    : faltantes.length === 0 ? "COMPLETA"
    : "INCOMPLETA";
  return { requeridos, subidos, faltantes, estado, ultimaSubida };
}

/** Opciones del desplegable "Documentos": "" = todos. */
export type FiltroDocumentacion = "" | "PENDIENTE" | EstadoDocumentacion;

export const OPCIONES_FILTRO_DOCUMENTACION: { value: FiltroDocumentacion; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "PENDIENTE", label: "Con documentos pendientes" },
  { value: "SIN_DOCUMENTOS", label: "Sin ningún documento" },
  { value: "INCOMPLETA", label: "Incompleta" },
  { value: "COMPLETA", label: "Completa" },
];

export function cumpleFiltroDocumentacion(estado: EstadoDocumentacion, filtro: FiltroDocumentacion): boolean {
  if (!filtro) return true;
  if (filtro === "PENDIENTE") return estado === "SIN_DOCUMENTOS" || estado === "INCOMPLETA";
  return estado === filtro;
}

/** Opciones del desplegable "Tipo": "" = todos. */
export type FiltroTipoPersona = "" | TipoPersona;

export function cumpleFiltroTipo(p: PersonaConDocumentos, filtro: FiltroTipoPersona): boolean {
  return !filtro || tipoDePersona(p) === filtro;
}

/**
 * Planilla de la documentación recibida, tal como se ve con los filtros:
 * una fila por persona y una columna por documento (Sí / No / No aplica),
 * para mandársela al proveedor y que complete lo que falta (26-09-2026).
 */
export type FilaDocumentacion = {
  nombre: string;
  rut?: string | null;
  telefono?: string | null;
  proveedor?: string | null;
  tipo: TipoPersona;
  doc: Documentacion;
};

export function planillaDocumentacion(filas: FilaDocumentacion[]): { headers: string[]; rows: string[][] } {
  const headers = [
    "Persona",
    "RUT",
    "Teléfono",
    "Proveedor",
    "Tipo",
    "Estado",
    "Subidos",
    "Faltan",
    "Última subida",
    ...DOCS_CONDUCTOR.map((d) => d.label),
  ];
  const rows = filas.map((f) => {
    const requeridos = new Set(f.doc.requeridos.map((d) => d.key));
    const subidos = new Set(f.doc.subidos.map((d) => d.key));
    return [
      f.nombre,
      f.rut ?? "",
      f.telefono ?? "",
      f.proveedor ?? "",
      TIPO_PERSONA_LABEL[f.tipo],
      ESTADO_DOCUMENTACION_LABEL[f.doc.estado],
      `${f.doc.subidos.length}/${f.doc.requeridos.length}`,
      f.doc.faltantes.map((d) => d.label).join(", "),
      f.doc.ultimaSubida ? f.doc.ultimaSubida.toLocaleDateString("es-CL") : "",
      ...DOCS_CONDUCTOR.map((d) => (!requeridos.has(d.key) ? "No aplica" : subidos.has(d.key) ? "Sí" : "No")),
    ];
  });
  return { headers, rows };
}
