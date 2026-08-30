/**
 * Motivos de denuncia compartidos por los chats de la plataforma.
 *
 * Viven en un único lugar porque son material de cumplimiento: la política de
 * contenido generado por usuarios de Google Play y App Store exige que el
 * usuario pueda denunciar contenido, y la lista que se le muestra debe ser la
 * misma en todas las superficies de chat.
 */
export const REPORT_REASONS = [
  { value: "OFFENSIVE", label: "Contenido ofensivo" },
  { value: "HARASSMENT", label: "Acoso o amenazas" },
  { value: "SPAM", label: "Spam o publicidad" },
  { value: "OTHER", label: "Otro motivo" },
] as const;

export const reportReasonLabel = (value: string) =>
  REPORT_REASONS.find((r) => r.value === value)?.label ?? value;

/** Categoría con la que se abre el caso de soporte de una denuncia. */
export const REPORT_CATEGORY = "ABUSE";
