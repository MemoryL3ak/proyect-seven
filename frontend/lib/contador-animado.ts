"use client";

import { useEffect, useRef, useState } from "react";

/** Suavizado de salida (cúbico): parte rápido y frena al llegar. */
export function suavizado(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3);
}

/** Valor intermedio del contador en el instante `t` (0 a 1). */
export function valorAnimado(desde: number, hasta: number, t: number): number {
  return desde + (hasta - desde) * suavizado(t);
}

/**
 * Cuenta desde el valor anterior hasta el nuevo en `duracionMs`. Al montar
 * parte de 0. Sin `requestAnimationFrame` (pruebas, servidor) devuelve el
 * valor final de inmediato.
 */
export function useContador(valor: number, duracionMs = 900): number {
  const [actual, setActual] = useState(0);
  const desdeRef = useRef(0);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      setActual(valor);
      return;
    }
    const desde = desdeRef.current;
    const inicio = performance.now();
    let id = 0;
    const paso = (ahora: number) => {
      const t = (ahora - inicio) / duracionMs;
      const v = valorAnimado(desde, valor, t);
      setActual(t >= 1 ? valor : v);
      if (t < 1) id = window.requestAnimationFrame(paso);
      else desdeRef.current = valor;
    };
    id = window.requestAnimationFrame(paso);
    return () => {
      window.cancelAnimationFrame(id);
      desdeRef.current = valor;
    };
  }, [valor, duracionMs]);
  return actual;
}
