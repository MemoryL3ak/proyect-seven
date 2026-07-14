import type { Viewport } from "next";

// El portal se usa como app en el teléfono: bloqueamos el zoom automático que
// iOS aplica al enfocar inputs con font-size < 16px (ej. el campo de origen).
// Este viewport sólo afecta a /portal/*, no a la plataforma de administración.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function PortalLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: "var(--elevated)" }}>
      {children}
    </div>
  );
}
