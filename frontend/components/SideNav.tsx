"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type NavGroup = {
  title: string;
  icon: string;
  items: NavItem[];
};

type NavSection = {
  title: string;
  icon: string;
  items?: NavItem[];
  groups?: NavGroup[];
  href?: string;
};

const navSections: NavSection[] = [
  {
    title: "Dashboard",
    icon: "dashboard",
    items: [
      { href: "/dashboard/comercial", label: "Dashboard Comercial", icon: "dashboard" },
      { href: "/dashboard/operacional", label: "Dashboard Operacional", icon: "dashboard" }
    ]
  },
  {
    title: "Registro",
    icon: "stack",
    items: [
      { href: "/registro/eventos", label: "Registro Evento", icon: "calendar" },
      { href: "/registro/participantes", label: "Inscripción Participantes", icon: "users" }
    ]
  },
  {
    title: "Operación",
    icon: "route",
    items: [
      { href: "/operacion/and", label: "AND", icon: "users" },
      { href: "/operacion/cumplimiento-and", label: "Cumplimiento AND", icon: "shield" }
    ],
    groups: [
      {
        title: "Transporte",
        icon: "route",
        items: [
          { href: "/operations/vehicle-positions", label: "Tracking de Viajes", icon: "pin" },
          { href: "/operations/trips", label: "Viajes", icon: "route" },
          { href: "/scanner", label: "Escáner QR", icon: "scan" }
        ]
      },
      {
        title: "Hotelería",
        icon: "hotel",
        items: [
          { href: "/operations/hotel-tracking", label: "Tracking Hotelería", icon: "hotel" },
          { href: "/masters/accommodations", label: "Hoteles", icon: "hotel" },
          { href: "/masters/hotel-rooms", label: "Habitaciones", icon: "hotel" },
          { href: "/operations/hotel-assignments", label: "Asignaciones Hotel", icon: "hotel" },
          { href: "/operations/hotel-keys", label: "Gestión de llaves", icon: "hotel" }
        ]
      },
      {
        title: "Alimentación",
        icon: "food",
        items: [
          { href: "/operations/food", label: "Alimentación", icon: "food" },
          { href: "/operations/food/cenas", label: "Cenas", icon: "food" },
          { href: "/operations/food/almuerzos", label: "Almuerzos", icon: "food" },
          { href: "/operations/food/lugares", label: "Lugares de comida", icon: "pin" }
        ]
      },
      {
        title: "Salud",
        icon: "health-cross",
        items: [{ href: "/health", label: "Salud", icon: "health-cross" }]
      }
    ]
  },
  {
    title: "Clientes",
    icon: "users",
    href: "/clientes"
  },
  {
    title: "Deportes",
    icon: "sports-rings",
    href: "/deportes"
  },
  {
    title: "Sede",
    icon: "pin",
    href: "/sede"
  },
  {
    title: "Calendario Deportivo",
    icon: "calendar",
    href: "/sports-calendar"
  },
  {
    title: "Acreditación",
    icon: "shield",
    href: "/accreditations"
  },
  {
    title: "Portales",
    icon: "portal",
    items: [
      { href: "/portal/user", label: "Portal de usuario", icon: "athlete" },
      { href: "/portal/conductor", label: "Portal Conductor", icon: "driver" },
      { href: "/portal/vehicle-request", label: "Solicitud de vehículo", icon: "route" }
    ]
  }
];

function Icon({ name, className }: { name: string; className?: string }) {
  const base = "w-[18px] h-[18px]";
  switch (name) {
    case "dashboard":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 9h18" />
        </svg>
      );
    case "users":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="8" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 20c0-3 2.5-5 5-5s5 2 5 5" />
          <path d="M14 20c0-2 1.5-3.5 3.5-3.5S21 18 21 20" />
        </svg>
      );
    case "hotel":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" />
        </svg>
      );
    case "athlete":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="7" r="3" />
          <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
        </svg>
      );
    case "driver":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="7" />
          <path d="M12 5v4M5 12h4M15 12h4M12 15v4" />
        </svg>
      );
    case "route":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M6 6c3 0 3 4 6 4s3-4 6-4" />
          <path d="M6 18c3 0 3-4 6-4s3 4 6 4" />
        </svg>
      );
    case "pin":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 22s6-6 6-11a6 6 0 0 0-12 0c0 5 6 11 6 11z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
    case "shield":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
        </svg>
      );
    case "health-cross":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M12 7v10M7 12h10" />
        </svg>
      );
    case "food":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M6 3v8M9 3v8M7.5 11v10" />
          <path d="M16 3c-2 2-2.5 4.5-2.5 7.5V21" />
          <path d="M16 3c2 2 2.5 4.5 2.5 7.5" />
        </svg>
      );
    case "scan":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 8V5a1 1 0 0 1 1-1h3" />
          <path d="M20 8V5a1 1 0 0 0-1-1h-3" />
          <path d="M4 16v3a1 1 0 0 0 1 1h3" />
          <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
          <path d="M7 12h10" />
          <path d="M12 7v10" />
        </svg>
      );
    case "stack":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
        </svg>
      );
    case "portal":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      );
    case "trophy":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M8 4h8v3a4 4 0 0 1-8 0V4z" />
          <path d="M6 4H4a3 3 0 0 0 3 3" />
          <path d="M18 4h2a3 3 0 0 1-3 3" />
          <path d="M12 13v3" />
          <path d="M8 20h8" />
          <path d="M9 16h6" />
        </svg>
      );
    case "sports-rings":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6.2" cy="9.2" r="3.1" />
          <circle cx="12" cy="9.2" r="3.1" />
          <circle cx="17.8" cy="9.2" r="3.1" />
          <circle cx="9.1" cy="14.8" r="3.1" />
          <circle cx="14.9" cy="14.8" r="3.1" />
        </svg>
      );
    default:
      return null;
  }
}

function sectionHasActivePath(section: NavSection, pathname: string) {
  if (section.href && pathname === section.href) return true;
  if (section.items?.some((item) => pathname === item.href)) return true;
  if (section.groups?.some((group) => group.items.some((item) => pathname === item.href))) return true;
  return false;
}

export default function SideNav() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const activeSection = navSections.find((section) => sectionHasActivePath(section, pathname));
    if (!activeSection) return;

    setOpenSections((prev) => {
      const next: Record<string, boolean> = {};
      navSections.forEach((section) => {
        next[section.title] = section.title === activeSection.title;
      });
      return { ...prev, ...next };
    });

    if (activeSection.groups) {
      const activeGroup = activeSection.groups.find((group) =>
        group.items.some((item) => item.href === pathname)
      );
      if (activeGroup) {
        const key = `${activeSection.title}::${activeGroup.title}`;
        setOpenGroups((prev) => ({ ...prev, [key]: true }));
      }
    }
  }, [pathname]);

  useEffect(() => {
    setOpenSections((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return navSections.reduce<Record<string, boolean>>((acc, section) => {
        acc[section.title] = section.title === "Dashboard";
        return acc;
      }, {});
    });
  }, []);

  return (
    <aside
      className="h-screen sticky top-0 flex flex-col shrink-0"
      style={{
        width: "260px",
        background: "#07101f",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "4px 0 40px rgba(0,0,0,0.7)",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Texture overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat", backgroundSize: "200px"
      }} />
      {/* Radial glow top */}
      <div style={{
        position: "absolute", top: "-60px", left: "50%", transform: "translateX(-50%)",
        width: "320px", height: "320px", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(30,58,138,0.55) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0
      }} />

      {/* Logo — no container borders, seamless */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{ padding: "0px 0px", position: "relative", zIndex: 1, overflow: "hidden", maxHeight: "140px" }}
      >
        <img
          src="/branding/LOGO-SEVEN.png"
          alt="Seven Arena"
          style={{
            width: "130%",
            marginLeft: "-15%",
            height: "auto",
            objectFit: "contain",
            filter: "drop-shadow(0 0 28px rgba(201,168,76,0.55)) drop-shadow(0 6px 18px rgba(0,0,0,0.9))"
          }}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "none", position: "relative", zIndex: 1 }}>
        {navSections.map((section) => {
          if (section.href) {
            const isActive = pathname === section.href || pathname.startsWith(section.href + "/");
            return (
              <Link
                key={section.title}
                href={section.href}
                className="flex items-center gap-3 mx-2 px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150 relative"
                style={{
                  color: isActive ? "#e8c96a" : "rgba(255,255,255,0.82)",
                  background: isActive ? "rgba(201,168,76,0.12)" : "transparent",
                  borderRadius: "8px",
                  borderLeft: isActive ? "3px solid #c9a84c" : "3px solid transparent",
                  marginBottom: "1px"
                }}
              >
                <Icon name={section.icon} />
                <span>{t(section.title)}</span>
              </Link>
            );
          }

          const isOpen = !!openSections[section.title];
          const sectionActive = sectionHasActivePath(section, pathname);

          return (
            <div key={section.title} style={{ marginBottom: "1px" }}>
              <button
                type="button"
                onClick={() =>
                  setOpenSections((prev) =>
                    navSections.reduce<Record<string, boolean>>((acc, cur) => {
                      acc[cur.title] = cur.title === section.title ? !prev[section.title] : false;
                      return acc;
                    }, {})
                  )
                }
                className="flex w-full items-center justify-between mx-0 px-5 py-2.5 text-[13.5px] font-semibold transition-all duration-150"
                style={{
                  color: sectionActive ? "#e8c96a" : "rgba(255,255,255,0.85)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  letterSpacing: "0.01em"
                }}
              >
                <span className="flex items-center gap-3">
                  <Icon name={section.icon} />
                  {t(section.title)}
                </span>
                <span style={{
                  fontSize: 8,
                  color: "rgba(255,255,255,0.2)",
                  transition: "transform 200ms ease",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  display: "inline-block"
                }}>▼</span>
              </button>

              <div
                style={{
                  overflow: "hidden",
                  maxHeight: isOpen ? "800px" : "0px",
                  opacity: isOpen ? 1 : 0,
                  transition: "max-height 280ms ease, opacity 200ms ease",
                }}
              >
                <div style={{ paddingLeft: "8px", paddingRight: "8px", paddingBottom: "4px", display: "flex", flexDirection: "column", gap: "1px" }}>
                  {section.items?.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 px-3 py-2 text-[12.5px] transition-all duration-150"
                        style={{
                          color: active ? "#e8c96a" : "rgba(255,255,255,0.65)",
                          background: active ? "rgba(201,168,76,0.1)" : "transparent",
                          fontWeight: active ? 600 : 400,
                          borderRadius: "7px",
                          borderLeft: active ? "2px solid #c9a84c" : "2px solid transparent",
                        }}
                      >
                        <Icon name={item.icon} />
                        {t(item.label)}
                      </Link>
                    );
                  })}

                  {section.groups?.map((group) => {
                    const groupKey = `${section.title}::${group.title}`;
                    const groupIsOpen = !!openGroups[groupKey];
                    const groupActive = group.items.some((i) => pathname === i.href);

                    return (
                      <div key={group.title}>
                        <p style={{
                          fontSize: "9.5px",
                          fontWeight: 700,
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.22)",
                          padding: "10px 12px 4px"
                        }}>
                          {t(group.title)}
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                          {group.items.map((item) => {
                            const active = pathname === item.href;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className="flex items-center gap-3 px-3 py-2 text-[12.5px] transition-all duration-150"
                                style={{
                                  color: active ? "#e8c96a" : "rgba(255,255,255,0.6)",
                                  background: active ? "rgba(201,168,76,0.1)" : "transparent",
                                  fontWeight: active ? 600 : 400,
                                  borderRadius: "7px",
                                  borderLeft: active ? "2px solid #c9a84c" : "2px solid transparent",
                                }}
                              >
                                <Icon name={item.icon} />
                                {t(item.label)}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Language switcher */}
      <div className="px-3 py-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative", zIndex: 1 }}>
        <p className="text-[10px] uppercase tracking-[0.18em] mb-2 px-1" style={{ color: "rgba(255,255,255,0.3)" }}>{t("Idioma")}</p>
        <div className="grid grid-cols-3 gap-1">
          {[
            { key: "es", label: "Español", short: "ES", flag: "🇨🇱" },
            { key: "en", label: "English",  short: "EN", flag: "🇺🇸" },
            { key: "pt", label: "Português",short: "PT", flag: "🇧🇷" }
          ].map((option) => {
            const active = locale === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setLocale(option.key as "es" | "en" | "pt")}
                className="flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all"
                style={{
                  background: active ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.05)",
                  color: active ? "#c9a84c" : "rgba(255,255,255,0.4)",
                  border: `1px solid ${active ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.1)"}`
                }}
                title={t(option.label)}
              >
                <span>{option.flag}</span>
                <span>{option.short}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
