"use client";

import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
// Side-effect import: registers window.__sevenNativeReceive so the native
// shell can push messages into the WebView from anywhere in the SPA.
import "@/lib/native-bridge";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </ThemeProvider>
  );
}
