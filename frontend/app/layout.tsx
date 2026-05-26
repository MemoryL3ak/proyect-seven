import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Seven | Plataforma Logística",
  description: "Control operativo y trazabilidad en tiempo real para eventos deportivos.",
  icons: {
    icon: "/branding/LOGO-SEVEN-3.png",
    apple: "/branding/LOGO-SEVEN-3.png",
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
