"use client";

import { useEffect, useRef } from "react";
import {
  deepLinkDeLaUrl,
  EVENTO_DEEP_LINK,
  limpiarUrlDeDeepLink,
  tomarDeepLinkPendiente,
  type DestinoNotificacion,
} from "@/lib/deep-link";

/**
 * La pantalla atiende los deep links de notificaciones: el que viene en la
 * URL al cargar, el que quedó pendiente (toque de push con la app cerrada)
 * y los que lleguen mientras está abierta (toque de push o campana). Se
 * atienden recién cuando `activo` es true (perfil cargado).
 */
export function useDeepLink(atender: (d: DestinoNotificacion) => void, activo = true): void {
  const atenderRef = useRef(atender);
  atenderRef.current = atender;

  useEffect(() => {
    if (!activo || typeof window === "undefined") return;
    const enUrl = deepLinkDeLaUrl(window.location.search);
    if (enUrl) {
      limpiarUrlDeDeepLink();
      atenderRef.current(enUrl);
    }
    const pendiente = tomarDeepLinkPendiente(window.location.pathname);
    if (pendiente && (pendiente.tripId || pendiente.premiacionId)) atenderRef.current(pendiente);
  }, [activo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onEvento = (e: Event) => {
      const d = (e as CustomEvent<DestinoNotificacion>).detail;
      if (d && (d.tripId || d.premiacionId)) atenderRef.current(d);
    };
    window.addEventListener(EVENTO_DEEP_LINK, onEvento);
    return () => window.removeEventListener(EVENTO_DEEP_LINK, onEvento);
  }, []);
}
