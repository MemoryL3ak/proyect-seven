// ─────────────────────────────────────────────────────────────
// SEVEN ARENA — tokens de diseño para código TS/inline styles.
// Fuente única de la marca y de los catálogos de estado que antes
// se redefinían por archivo. El equivalente CSS vive en globals.css
// (variables --brand, --success, etc.); este módulo es para el código
// que pinta con style={{}} o construye estilos dinámicos.
// ─────────────────────────────────────────────────────────────

export const BRAND = {
  teal: "#21D0B3",
  tealLight: "#34F3C6",
  tealDark: "#0fa894",
  tealInk: "#0a7a6b",       // texto sobre fondos teal-dim
  blue: "#1FCDFF",
  charcoal: "#30455B",
  navy: "#041a2e",          // gradiente oscuro del portal
  navyLight: "#062240",
} as const;

export const SURFACE = {
  bg: "#f8fafc",            // fondo de página del portal
  card: "#ffffff",
  border: "#e2e8f0",
  borderMuted: "#f1f5f9",
  text: "#0f172a",
  textMuted: "#64748b",
  textFaint: "#94a3b8",
} as const;

// Escala tipográfica móvil (px). Piso legible en pantalla táctil:
// nada informativo bajo `caption`; `micro` queda solo para chips/etiquetas.
export const FONT = {
  micro: 10,     // chips, badges, etiquetas MAYÚSCULAS
  caption: 11,   // metadatos, filas secundarias
  body: 12.5,    // texto informativo
  emphasis: 13.5,// títulos de tarjeta
  title: 16,     // títulos de sección
} as const;

export type StatusMeta = { label: string; bg: string; color: string };

// ── Estados de viaje (trips) — catálogo canónico ─────────────
// Los labels son claves i18n: envolver en t(meta.label) al renderizar.
export const TRIP_STATUS_META: Record<string, StatusMeta> = {
  REQUESTED:   { label: "Solicitado",  bg: "#FEF3C7",               color: "#92400E" },
  SCHEDULED:   { label: "Programado",  bg: "rgba(33,208,179,0.12)", color: "#0f9e87" },
  EN_ROUTE:    { label: "En ruta",     bg: "rgba(59,130,246,0.12)", color: "#2563eb" },
  PICKED_UP:   { label: "En curso",    bg: "rgba(139,92,246,0.12)", color: "#7c3aed" },
  DROPPED_OFF: { label: "Completado",  bg: "#f1f5f9",               color: "#64748b" },
  COMPLETED:   { label: "Completado",  bg: "#f1f5f9",               color: "#64748b" },
  CANCELLED:   { label: "Cancelado",   bg: "rgba(239,68,68,0.1)",   color: "#dc2626" },
};

// ── Estados de solicitud (vehicle-request / trip-requests) ───
export const REQUEST_STATUS_META: Record<string, StatusMeta> = {
  PENDING:   { label: "Pendiente",  bg: "#FEF3C7",               color: "#92400E" },
  REQUESTED: { label: "Solicitado", bg: "#FEF3C7",               color: "#92400E" },
  APPROVED:  { label: "Aprobado",   bg: "rgba(33,208,179,0.12)", color: "#0f9e87" },
  REJECTED:  { label: "Rechazado",  bg: "rgba(239,68,68,0.1)",   color: "#dc2626" },
  CANCELLED: { label: "Cancelado",  bg: "#f1f5f9",               color: "#64748b" },
};

const FALLBACK_STATUS: StatusMeta = { label: "—", bg: "#f1f5f9", color: "#64748b" };

/** Meta de un estado de viaje; acepta cualquier casing y cae en un neutro. */
export function tripStatusMeta(status?: string | null): StatusMeta {
  if (!status) return FALLBACK_STATUS;
  return TRIP_STATUS_META[status.trim().toUpperCase()] ?? { ...FALLBACK_STATUS, label: status };
}

/** Meta de un estado de solicitud; mismo contrato que tripStatusMeta. */
export function requestStatusMeta(status?: string | null): StatusMeta {
  if (!status) return FALLBACK_STATUS;
  return REQUEST_STATUS_META[status.trim().toUpperCase()] ?? { ...FALLBACK_STATUS, label: status };
}
