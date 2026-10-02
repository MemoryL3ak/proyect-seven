"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAvailable, on } from "@/lib/native-bridge";
import { abrirDeepLink, destinoDeNotificacion } from "@/lib/deep-link";

/**
 * Toque de una notificación push, en cualquier pantalla (02-10-2026). Vive
 * en Providers, no en los portales: con la app cerrada el shell emite el
 * toque 1,5 s después de arrancar, cuando el WebView todavía está en
 * /m/login, y antes nadie lo escuchaba. El destino queda pendiente y el
 * portal lo atiende al cargar (use-deep-link.ts); si ya se está en la
 * página, se atiende en el acto.
 */
export default function DeepLinkDesdePush() {
  const router = useRouter();
  useEffect(() => {
    if (!isAvailable()) return;
    return on("push.tap", (payload) => {
      abrirDeepLink(destinoDeNotificacion(payload), (url) => router.push(url), window.location.pathname);
    });
  }, [router]);
  return null;
}
