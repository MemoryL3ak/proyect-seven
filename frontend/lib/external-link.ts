// Abrir un enlace externo (WhatsApp, mapa, web) desde los portales.
//
// Dentro de la app nativa el WebView no abre esquemas externos por sí mismo
// (ver seven-arena-app/app/index.tsx, handler `url.open`, que admite tel:,
// sms:, mailto:, https: y whatsapp:). Ahí el enlace tiene que viajar por el
// bridge para que el shell haga Linking.openURL. En un navegador normal se
// abre en una pestaña nueva.

import { isAvailable as nativeAvailable, send as nativeSend } from "@/lib/native-bridge";

/** Solo dígitos: wa.me no admite "+", espacios ni guiones. */
export function whatsappDigits(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/** Enlace universal de WhatsApp con mensaje prellenado opcional. */
export function whatsappHref(phone: string, text?: string): string {
  const base = `https://wa.me/${whatsappDigits(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function openExternal(url: string): void {
  if (nativeAvailable()) {
    nativeSend("url.open", { url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
