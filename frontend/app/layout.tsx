import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Seven | Plataforma Logística",
  description: "Control operativo y trazabilidad en tiempo real para eventos deportivos.",
  // El logo de Seven (LOGO-SEVEN-3) reducido a los tamaños de ícono: antes el
  // navegador descargaba la imagen de 2084 px, /favicon.ico no existía y
  // /apple-touch-icon.png redirigía al login (13-10-2026). Mismo dibujo; el
  // logo no se cambia sin que lo pida Ariel.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
