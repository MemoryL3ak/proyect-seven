// Marcar un teléfono desde los portales.
//
// Dentro de la app nativa el WebView no maneja `tel:` por sí mismo (ver
// seven-arena-app/app/index.tsx, handler `url.open`): un <a href="tel:…">
// pelado se toca y no pasa nada. Ahí el marcado tiene que viajar por el
// bridge para que el shell haga Linking.openURL. En un navegador normal,
// `tel:` funciona solo. Este helper decide por el llamador.
//
// EmergencyNumbersSection resuelve lo mismo con más ceremonia (iframe,
// ventana nueva, panel de respaldo con el número) porque ahí no hay margen
// para que falle. Para un botón de "Llamar" corriente alcanza con esto.

import { isAvailable as nativeAvailable, send as nativeSend } from "@/lib/native-bridge";

/** `tel:` limpio: solo dígitos y el "+" inicial. Un espacio o guion rompe iOS. */
export function telHref(phone: string): string {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return `tel:${plus}${trimmed.replace(/[^\d]/g, "")}`;
}

/**
 * Marca el número. Devuelve true si lo delegó al shell nativo (el llamador
 * debe hacer preventDefault sobre el <a>), false si dejó que el navegador
 * siga el enlace.
 */
export function dialPhone(phone: string): boolean {
  if (!nativeAvailable()) return false;
  nativeSend("url.open", { url: telHref(phone) });
  return true;
}
