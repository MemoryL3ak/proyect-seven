"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";

/**
 * Barra inferior del panel en el teléfono (app staff). Lleva a las cuatro
 * pantallas que el staff abre a cada rato y el quinto botón despliega el
 * menú completo. En escritorio no se muestra: ahí está el menú lateral.
 */
type Tab = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
  icon: React.ReactNode;
};

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const TABS: Tab[] = [
  {
    href: "/",
    label: "Inicio",
    isActive: (p) => p === "/" || p.startsWith("/dashboard") || p === "/commercial",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
        <path d="M3 11l9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" />
      </svg>
    ),
  },
  {
    href: "/operations/trips",
    label: "Viajes",
    isActive: (p) => p.startsWith("/operations/trips") || p.startsWith("/operations/trip-requests"),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
        <path d="M6 6c3 0 3 4 6 4s3-4 6-4" /><path d="M6 18c3 0 3-4 6-4s3 4 6 4" />
      </svg>
    ),
  },
  {
    href: "/operations/vehicle-positions",
    label: "Tracking",
    isActive: (p) => p.startsWith("/operations/vehicle-positions") || p.startsWith("/operations/driver-monitoring"),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
        <path d="M12 22s6-6 6-11a6 6 0 0 0-12 0c0 5 6 11 6 11z" /><circle cx="12" cy="11" r="2" />
      </svg>
    ),
  },
  {
    href: "/registro/participantes",
    label: "Registro",
    isActive: (p) => p.startsWith("/registro") || p.startsWith("/users"),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
        <circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c0-3 2.5-5 5-5s5 2 5 5" /><path d="M14 20c0-2 1.5-3.5 3.5-3.5S21 18 21 20" />
      </svg>
    ),
  },
];

export default function MobileTabBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "3px",
    minHeight: "56px",
    padding: "6px 2px",
    fontSize: "10.5px",
    fontWeight: 700,
    letterSpacing: "0.01em",
    color: active ? BRAND.tealDark : SURFACE.textMuted,
    textDecoration: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  });

  const iconWrap = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "44px",
    height: "28px",
    borderRadius: "14px",
    background: active ? "rgba(33,208,179,0.16)" : "transparent",
    transition: "background 150ms ease",
  });

  return (
    <nav
      className="md:hidden mobile-tabbar"
      aria-label="Navegación principal"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 35,
        // El display va en globals.css (.mobile-tabbar): puesto aquí en línea
        // pisaba al md:hidden y la barra salía también en el escritorio.
        gridTemplateColumns: "repeat(5, 1fr)",
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: `1px solid ${SURFACE.border}`,
        boxShadow: "0 -4px 18px rgba(15,23,42,0.06)",
      }}
    >
      {TABS.map((tab) => {
        const active = tab.isActive(pathname);
        return (
          <Link key={tab.href} href={tab.href} style={itemStyle(active)} aria-current={active ? "page" : undefined}>
            <span style={iconWrap(active)}>{tab.icon}</span>
            <span>{t(tab.label)}</span>
          </Link>
        );
      })}
      <button type="button" onClick={onMenuOpen} style={itemStyle(false)} aria-label="Abrir menú">
        <span style={iconWrap(false)}>
          <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </span>
        <span>{t("Menú")}</span>
      </button>
    </nav>
  );
}
