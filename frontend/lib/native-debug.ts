/**
 * ⚠ DIAGNÓSTICO TEMPORAL (quitar cuando se resuelva el congelamiento del
 * portal conductor dentro de la app). Registro liviano de hitos del arranque
 * y errores globales, para renderizarlos en un overlay visible en pantalla:
 * una captura del teléfono muestra el último paso ejecutado y si el hilo JS
 * sigue vivo (contador de latido).
 */

type Listener = () => void;

const MAX = 14;
const entries: string[] = [];
const listeners = new Set<Listener>();
let armed = false;

function stamp(): string {
  const d = new Date();
  return `${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

export function dlog(msg: string): void {
  entries.push(`${stamp()} ${msg}`);
  if (entries.length > MAX) entries.shift();
  listeners.forEach((fn) => {
    try { fn(); } catch {}
  });
}

export function dlogEntries(): readonly string[] {
  return entries;
}

export function dlogSubscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Captura errores globales una sola vez. */
export function dlogArmGlobal(): void {
  if (armed || typeof window === "undefined") return;
  armed = true;
  window.addEventListener("error", (e) => {
    dlog(`❌ error: ${e.message} @${(e.filename || "").split("/").pop()}:${e.lineno}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    dlog(`❌ rechazo: ${r instanceof Error ? r.message : String(r).slice(0, 120)}`);
  });
}
