/**
 * Con qué transmite cada conductor, para que el monitor diga por qué uno no
 * llega (30-09-2026: "en los dispositivos Android a algunos no les llega la
 * ubicación"). El latido del portal mandaba platform: "web" para todos y sin
 * versión, así que desde el panel no se distinguía la app del navegador, ni
 * un shell antiguo de uno sin el permiso "Permitir todo el tiempo".
 *
 * El código va en transport.driver_sessions.platform. La parte antes de ":"
 * es el medio (app o navegador y sistema); la de después, el estado del
 * rastreo nativo que informó el shell.
 */

export type EstadoShell =
  | { running?: boolean; backgroundOk?: boolean; gpsServices?: boolean; background?: string }
  | null
  | undefined;

export type SistemaTelefono = "android" | "iphone" | "otro";

export function sistemaDelTelefono(userAgent: string | null | undefined): SistemaTelefono {
  const ua = String(userAgent ?? "");
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iphone";
  return "otro";
}

/**
 * Versión del shell que se puede deducir desde la web: sólo el 1.0.2 devuelve
 * `backgroundOk` en tracking.status. Sin respuesta no se sabe.
 */
export function versionShell(shell: EstadoShell): string | null {
  if (!shell) return null;
  return "backgroundOk" in shell ? "1.0.2+" : "1.0.1";
}

export function plataformaConductor(args: {
  userAgent?: string | null;
  dentroDeLaApp: boolean;
  shell: EstadoShell;
}): string {
  const so = sistemaDelTelefono(args.userAgent);
  if (!args.dentroDeLaApp) return so === "otro" ? "navegador" : `navegador-${so}`;
  const base = `app-${so === "otro" ? "movil" : so}`;
  const s = args.shell;
  if (!s) return `${base}:sin-respuesta`;
  if (!("backgroundOk" in s)) return `${base}:antigua`;
  if (s.gpsServices === false) return `${base}:gps-apagado`;
  if (s.backgroundOk === false) return `${base}:sin-fondo`;
  if (s.running === false) return `${base}:detenido`;
  return `${base}:fondo-ok`;
}

const MEDIO: Record<string, string> = {
  "app-android": "App Android",
  "app-iphone": "App iPhone",
  "app-movil": "App",
  "navegador-android": "Navegador Android",
  "navegador-iphone": "Navegador iPhone",
  navegador: "Navegador",
  web: "Web",
};

const ESTADO: Record<string, { texto: string; alerta: boolean }> = {
  "fondo-ok": { texto: "rastreo en segundo plano", alerta: false },
  "sin-fondo": { texto: "sin permiso \"todo el tiempo\": se corta al minimizar", alerta: true },
  "gps-apagado": { texto: "GPS apagado", alerta: true },
  detenido: { texto: "rastreo detenido", alerta: true },
  antigua: { texto: "versión antigua, sin rastreo de fondo: actualizar", alerta: true },
  "sin-respuesta": { texto: "estado del rastreo desconocido", alerta: false },
};

/**
 * Texto para el panel y si merece color de alerta. Un código que no se
 * reconoce se muestra tal cual.
 */
export function etiquetaPlataforma(codigo: string | null | undefined): { texto: string; alerta: boolean } | null {
  const c = String(codigo ?? "").trim();
  if (!c) return null;
  const [medio, estado] = c.split(":");
  const nombreMedio = MEDIO[medio];
  if (!nombreMedio) return { texto: c, alerta: false };
  if (!estado) {
    // En el navegador no hay rastreo de fondo: se avisa.
    const sinFondo = medio.startsWith("navegador");
    return { texto: sinFondo ? `${nombreMedio} · sin rastreo de fondo` : nombreMedio, alerta: sinFondo };
  }
  const e = ESTADO[estado];
  if (!e) return { texto: `${nombreMedio} · ${estado}`, alerta: false };
  return { texto: `${nombreMedio} · ${e.texto}`, alerta: e.alerta };
}

/**
 * Código de conductor usado en más de un teléfono el mismo día (02-10-2026:
 * Juan Villegas, un iPhone en Concón y su Android en Santiago; cada login
 * desplaza la sesión del otro y el GPS se mezcla). `dispositivos` son los
 * tipos de teléfono con sesión hoy; con uno solo no hay aviso.
 */
export function avisoCodigoCompartido(dispositivos: string[] | null | undefined): string | null {
  const distintos = Array.from(new Set((dispositivos ?? []).filter((d) => d && d !== "otro")));
  if (distintos.length < 2) return null;
  return `Código en ${distintos.length} teléfonos hoy: ${distintos.join(" y ")}`;
}

/** ¿El error de la API dice que esta sesión de portal ya no vale (otro teléfono la tomó)? */
export function esSesionDesplazada(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return status === 401;
}
