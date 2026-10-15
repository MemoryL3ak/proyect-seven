/**
 * Por qué falló el ingreso al portal con un código (15-10-2026). Antes
 * cualquier falla decía "El ID ingresado no corresponde a un conductor
 * registrado": con la app trabada o sin señal, el conductor creía que su
 * código estaba malo. Sólo un rechazo del servidor (401/403/404/400) es un
 * código inválido; una falla de red, un corte o un error 5xx es de conexión.
 */
export type MotivoIngreso = "codigo" | "conexion";

export function motivoErrorIngreso(err: unknown): MotivoIngreso {
  const status = typeof err === "object" && err !== null ? (err as { status?: unknown }).status : undefined;
  if (status === 400 || status === 401 || status === 403 || status === 404) return "codigo";
  return "conexion";
}

export const MENSAJE_SIN_CONEXION = "No pudimos conectar con el servidor. Revisa tu señal e intenta de nuevo.";
