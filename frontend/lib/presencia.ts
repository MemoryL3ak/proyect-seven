"use client";

import { useCallback, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";

/**
 * Conectado / sin conexión de un conductor, con una sola regla para todo el
 * panel.
 *
 * Tracking de vehículos decía "conectado" sólo con una posición de menos de
 * 15 s, y el conductor manda cada 20 s cuando está quieto: quedaba verde 15 s
 * y rojo 5, en cada ciclo. Monitoreo de conductores usaba 60 s y el servidor
 * 100 s. Acá va la ventana única, más larga que la cadencia del teléfono
 * (20 s) más el refresco del panel (8 s) más la latencia.
 */
export const VENTANA_CONECTADO_MS = 60 * 1000;

/** Más viejo que esto, el conductor ya ni se dibuja: no hay señal. */
export const VENTANA_SIN_SENAL_MS = 5 * 60 * 1000;

/**
 * Desfase (ms) que hay que sumar al reloj local para obtener el del servidor.
 * `t0` y `t1` son el reloj local antes y después de pedir la hora: la hora
 * del servidor corresponde a la mitad del viaje.
 */
export function desfaseReloj(serverNowIso: string, t0: number, t1: number): number {
  const servidor = new Date(serverNowIso).getTime();
  if (!Number.isFinite(servidor)) return 0;
  return servidor - (t0 + t1) / 2;
}

export type EstadoConexion = { ageMs: number; conectado: boolean; sinSenal: boolean };

/**
 * Estado de una posición según cuándo la recibió el servidor y qué hora es en
 * el servidor. Las dos horas son del servidor: el reloj del teléfono puede ir
 * minutos corrido y el del PC del operador unos segundos, y cualquiera de los
 * dos hacía parpadear el estado.
 */
export function estadoConexion(receivedAtIso: string | null | undefined, ahoraServidorMs: number): EstadoConexion | null {
  const ts = new Date(receivedAtIso ?? "").getTime();
  if (!Number.isFinite(ts)) return null;
  const ageMs = ahoraServidorMs - ts;
  return { ageMs, conectado: ageMs < VENTANA_CONECTADO_MS, sinSenal: ageMs >= VENTANA_SIN_SENAL_MS };
}

/**
 * Reloj del servidor en el navegador: devuelve una función `ahora()` que da
 * la hora del servidor en ms. Mide el desfase al montar y cada minuto.
 */
export function useRelojServidor(): () => number {
  const desfase = useRef(0);
  useEffect(() => {
    let vivo = true;
    const medir = async () => {
      try {
        const t0 = Date.now();
        const r = await apiFetch<{ now: string }>("/vehicle-positions/server-time");
        const t1 = Date.now();
        if (vivo) desfase.current = desfaseReloj(r?.now, t0, t1);
      } catch {
        // sin hora del servidor se sigue con la local, como antes
      }
    };
    void medir();
    const timer = setInterval(() => void medir(), 60_000);
    return () => {
      vivo = false;
      clearInterval(timer);
    };
  }, []);
  return useCallback(() => Date.now() + desfase.current, []);
}
