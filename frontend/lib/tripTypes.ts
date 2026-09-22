/**
 * Tipos de servicio de un viaje. La lista canónica vive acá porque el maestro
 * de Viajes, el detalle del panel y el Portal Conductor traducían cada uno por
 * su cuenta el mismo código, y no siempre igual.
 */
export const TRIP_TYPE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Transfer In Out", value: "TRANSFER_IN_OUT" },
  { label: "Transfer In (llegada)", value: "TRANSFER_IN" },
  { label: "Transfer Out (salida)", value: "TRANSFER_OUT" },
  { label: "Disposición 12 horas", value: "DISPOSICION_12H" },
  { label: "Viaje de ida", value: "VIAJE_IDA" },
  { label: "Viaje de regreso", value: "VIAJE_REGRESO" },
  { label: "Viaje de ida y regreso", value: "VIAJE_IDA_REGRESO" },
  // Traslado de la delegación al comedor (ida o vuelta del almuerzo).
  { label: "Comedor", value: "COMEDOR" },
  { label: "Solicitud portal", value: "PORTAL_REQUEST" },
];

/** Códigos viejos que siguen guardados en viajes ya creados. */
const LEGACY_TRIP_TYPES: Record<string, string> = {
  IDA_VUELTA: "Viaje de ida y regreso",
};

/**
 * Nombre visible del tipo de servicio. Si el código no está en el catálogo se
 * devuelve tal cual vino, sin pasarlo a mayúsculas: la importación de la
 * planilla guarda la actividad en `trip_type`, y "Entrenamiento" leído como
 * código salía en pantalla como "ENTRENAMIENTO".
 */
export function tripTypeLabel(value?: string | null): string {
  const texto = String(value || "").trim();
  if (!texto) return "";
  const code = texto.toUpperCase();
  return (
    TRIP_TYPE_OPTIONS.find((option) => option.value === code)?.label ||
    LEGACY_TRIP_TYPES[code] ||
    texto
  );
}

/**
 * Tramo de un viaje de ida y vuelta: qué mitad es este registro. La planilla
 * de operatividad escribe "Ida"/"Retorno" y el backend las normaliza a
 * OUTBOUND/RETURN, así que se aceptan las dos formas.
 */
export function legTypeLabel(value?: string | null): string {
  const code = String(value || "").trim().toUpperCase();
  if (code === "OUTBOUND" || code === "IDA") return "Tramo de ida";
  if (code === "RETURN" || code === "RETORNO" || code === "REGRESO") return "Tramo de regreso";
  return "";
}
