// Abrir un enlace externo (WhatsApp, mapa, web) desde los portales.
//
// Dentro de la app nativa el WebView no abre esquemas externos por sí mismo
// (ver seven-arena-app/app/index.tsx, handler `url.open`, que admite tel:,
// sms:, mailto:, https: y whatsapp:). Ahí el enlace tiene que viajar por el
// bridge para que el shell haga Linking.openURL. En un navegador normal se
// abre en una pestaña nueva.

import { isAvailable as nativeAvailable, send as nativeSend } from "@/lib/native-bridge";

/** Solo dígitos: wa.me no admite "+", espacios ni guiones. */
/**
 * Prefijo con que arranca el campo de teléfono: Chile. Se muestra apenas se
 * abre el formulario para que el usuario solo escriba el celular.
 */
export const PHONE_PREFIX_CL = "+56 ";

/**
 * Formato de WhatsApp mientras se escribe: "+56 9 9545 5073".
 * - Celular chileno sin código (parte con 9, hasta 9 dígitos) → se le antepone +56.
 * - Con +56 (o 56) se agrupa 9 XXXX XXXX y se corta en 9 dígitos.
 * - Otro código de país se conserva tal cual: "+" y sólo dígitos (máx. 15).
 * Vacío o sólo el prefijo se devuelve tal cual para que se pueda borrar.
 */
export function formatWhatsappPhone(raw: string): string {
  const typed = raw.trim();
  let digits = typed.replace(/\D/g, "");
  if (!digits) return typed.startsWith("+") ? "+" : "";
  if (!typed.startsWith("+") && digits.startsWith("9") && digits.length <= 9) digits = `56${digits}`;
  if (digits.startsWith("56")) {
    const rest = digits.slice(2, 11);
    const groups = [rest.slice(0, 1), rest.slice(1, 5), rest.slice(5, 9)].filter(Boolean);
    return ["+56", ...groups].join(" ");
  }
  return `+${digits.slice(0, 15)}`;
}

/**
 * Valor que se guarda: formateado, o "" si sólo quedó el prefijo de país
 * (el campo es opcional y arranca con "+56 " puesto).
 */
export function cleanWhatsappPhone(raw: string): string {
  return whatsappDigits(raw).length > 2 ? formatWhatsappPhone(raw) : "";
}

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
