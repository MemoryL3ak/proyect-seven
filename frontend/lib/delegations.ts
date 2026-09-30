import { nombreDePais } from "@/lib/paises";

/**
 * Etiqueta visible de una delegación. En los Juegos Escolares las delegaciones
 * son regiones y llevan nombre ("Región de Valparaíso"); las de países sólo
 * tienen código ("CHL"). Antes cada pantalla mostraba el código a secas.
 */
export type DelegationLike = {
  id?: string | null;
  countryCode?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function delegationLabel(delegation?: DelegationLike | null): string {
  if (!delegation) return "";
  const metaName = delegation.metadata?.name;
  const name = (delegation.name ?? (typeof metaName === "string" ? metaName : null))?.trim() || "";
  const codigo = String(delegation.countryCode ?? "").trim();
  // Delegación de país sin nombre propio (Rugby: "CAN"): el nombre del país.
  if (/^[A-Za-z]{3}$/.test(codigo) && (!name || name.toUpperCase() === codigo.toUpperCase())) {
    return nombreDePais(codigo);
  }
  return name || codigo || delegation.id || "";
}

/** Región de Chile (Juegos Escolares) o país (Rugby). */
export function esRegion(delegation?: DelegationLike | null): boolean {
  if (!delegation) return false;
  const metaName = delegation.metadata?.name;
  const name = delegation.name ?? (typeof metaName === "string" ? metaName : "");
  return (
    delegation.metadata?.kind === "REGION" ||
    /^CL-/i.test(String(delegation.countryCode ?? "")) ||
    /^regi[oó]n\b/i.test(String(name ?? "").trim())
  );
}

/**
 * Cómo se llama la delegación en pantalla (29-09-2026): en Rugby el detalle
 * del viaje decía "Región: CAN". Con la delegación del viaje, según sea; sin
 * ella, según las del evento (si alguna es región, es un evento de regiones).
 */
export function etiquetaDeDelegacion(
  delegation: DelegationLike | null | undefined,
  delEvento: DelegationLike[] = [],
): "Región" | "País" {
  if (delegation) return esRegion(delegation) ? "Región" : "País";
  if (delEvento.length === 0 || delEvento.some(esRegion)) return "Región";
  return "País";
}

/** Regiones de Chile (ISO 3166-2), para el maestro de delegaciones. */
export const CHILE_REGIONS: Array<{ label: string; value: string }> = [
  { label: "Región de Arica y Parinacota", value: "CL-AP" },
  { label: "Región de Tarapacá", value: "CL-TA" },
  { label: "Región de Antofagasta", value: "CL-AN" },
  { label: "Región de Atacama", value: "CL-AT" },
  { label: "Región de Coquimbo", value: "CL-CO" },
  { label: "Región de Valparaíso", value: "CL-VS" },
  { label: "Región Metropolitana de Santiago", value: "CL-RM" },
  { label: "Región del Libertador General Bernardo O'Higgins", value: "CL-LI" },
  { label: "Región del Maule", value: "CL-ML" },
  { label: "Región de Ñuble", value: "CL-NB" },
  { label: "Región del Biobío", value: "CL-BI" },
  { label: "Región de La Araucanía", value: "CL-AR" },
  { label: "Región de Los Ríos", value: "CL-LR" },
  { label: "Región de Los Lagos", value: "CL-LL" },
  { label: "Región de Aysén del General Carlos Ibáñez del Campo", value: "CL-AI" },
  { label: "Región de Magallanes y de la Antártica Chilena", value: "CL-MA" },
];
