"use client";

import { useEffect, useState } from "react";

/**
 * true bajo 768px de ancho (móvil / app staff). Para los layouts con estilos
 * inline que no pueden usar media queries: alturas de mapas, grids
 * lado-a-lado, paneles fijos, etc.
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}
