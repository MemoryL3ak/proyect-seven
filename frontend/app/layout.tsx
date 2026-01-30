import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const sans = Sora({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Seven | Plataforma Logística",
  description: "Control operativo y trazabilidad en tiempo real para eventos deportivos."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={sans.variable} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
