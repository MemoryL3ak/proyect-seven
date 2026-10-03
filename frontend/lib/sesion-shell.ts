/**
 * Lo que el portal del conductor le entrega al shell nativo para que el GPS
 * de fondo salga firmado con la sesión única del portal.
 *
 * 02-10-2026: un iPhone en Concón entró con el código de Juan Villegas y su
 * GPS llegó como si fuera el bus, que iba por Santiago. El servidor no podía
 * distinguir los dos teléfonos porque el shell mandaba los fijos sin
 * credenciales. Con el sessionId, sólo el teléfono que tiene la sesión
 * reporta la posición; el otro recibe 401 y deja de mezclar el mapa.
 */
import { send } from "./native-bridge";
import { getStoredPortalSessionId } from "./portal-session";

export type CargaDeRastreo = { driverId: string; sessionId?: string };

/** Payload de tracking.start / tracking.session: sin sesión guardada no se manda el campo. */
export function cargaDeRastreo(driverId: string, sessionId: string | null | undefined): CargaDeRastreo {
  return sessionId ? { driverId, sessionId } : { driverId };
}

/** Avisa al shell la sesión vigente de este teléfono (login y "volver a entrar"). */
export function informarSesionAlShell(driverId: string): void {
  send("tracking.session", cargaDeRastreo(driverId, getStoredPortalSessionId("driver", driverId)));
}
