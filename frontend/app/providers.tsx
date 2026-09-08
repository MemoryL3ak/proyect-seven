"use client";

import { useEffect } from "react";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
// Side-effect import: registers window.__sevenNativeReceive so the native
// shell can push messages into the WebView from anywhere in the SPA.
import { isAvailable as isNativeShell } from "@/lib/native-bridge";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Dentro de los shells nativos (app principal y app staff), el WebView de
    // iOS hace auto-zoom al enfocar inputs con letra < 16px y el zoom queda
    // pegado al navegar (dashboard ampliado y cortado). maximum-scale=1 lo
    // desactiva solo en la app; en navegador el viewport queda intacto.
    if (!isNativeShell()) return;
    const meta = document.querySelector('meta[name="viewport"]');
    meta?.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover");
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </ThemeProvider>
  );
}
