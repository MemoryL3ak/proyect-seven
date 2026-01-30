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

type NavSection = {
  title: string;
  icon: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Overview",
    icon: "dashboard",
    items: [{ href: "/", label: "Dashboard", icon: "dashboard" }]
  },
  {
    title: "Maestros",
    icon: "stack",
    items: [
      { href: "/masters/events", label: "Eventos", icon: "calendar" },
      { href: "/masters/delegations", label: "Delegaciones", icon: "users" },
      { href: "/masters/disciplines", label: "Disciplinas", icon: "trophy" },
      { href: "/masters/accommodations", label: "Hotelería", icon: "hotel" },
      { href: "/masters/providers", label: "Proveedores", icon: "users" }
    ]
  },
  {
    title: "Usuarios",
    icon: "users",
    items: [
      { href: "/users/athletes", label: "Participantes", icon: "athlete" },
      { href: "/users/drivers", label: "Conductores", icon: "driver" }
    ]
  },
  {
    title: "Operaciones",
    icon: "route",
    items: [
      { href: "/operations/trips", label: "Viajes", icon: "route" },
      { href: "/operations/vehicle-positions", label: "Tracking de viajes", icon: "pin" },
      { href: "/operations/hotel-tracking", label: "Tracking hotelería", icon: "hotel" }
    ]
  },
  {
    title: "Control",
    icon: "shield",
    items: [
      { href: "/incidents", label: "Incidentes", icon: "alert" },
      { href: "/reports", label: "Reportes", icon: "file" }
    ]
  },
  {
    title: "Portales",
    icon: "portal",
    items: [
      { href: "/portal/user", label: "Portal de usuario", icon: "athlete" },
      { href: "/portal/conductor", label: "Portal Conductor", icon: "driver" }
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
    case "plane":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M2 16l20-6-20-6 5 6-5 6z" />
          <path d="M7 10h7" />
        </svg>
      );
    case "truck":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="2" y="7" width="12" height="8" rx="1.5" />
          <path d="M14 10h4l3 3v2h-7" />
          <circle cx="6" cy="17" r="2" />
          <circle cx="18" cy="17" r="2" />
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
    case "alert":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3l9 16H3L12 3z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case "file":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M14 3v6h6" />
        </svg>
      );
    case "shield":
      return (
        <svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
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
    default:
      return null;
  }
}

export default function SideNav() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const activeSection = navSections.find((section) =>
      section.items.some((item) => item.href === pathname)
    );
    if (!activeSection) return;

    setOpenSections((prev) => {
      const next: Record<string, boolean> = {};
      navSections.forEach((section) => {
        next[section.title] = section.title === activeSection.title;
      });
      return { ...prev, ...next };
    });
  }, [pathname]);

  useEffect(() => {
    setOpenSections((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return navSections.reduce<Record<string, boolean>>((acc, section) => {
        acc[section.title] = section.title === "Overview";
        return acc;
      }, {});
    });
  }, []);

  return (
    <aside className="w-full max-w-[270px] bg-white border-r border-slate-200 px-5 py-6 h-screen sticky top-0">
      <div className="flex h-full flex-col">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Seven</p>
          <h1 className="text-xl font-semibold text-ink">Logistic Core</h1>
        </div>

        <nav className="space-y-5 flex-1">
        {navSections.map((section) => {
          const isOpen = openSections[section.title];
          return (
            <div key={section.title}>
              <button
                type="button"
                onClick={() =>
                  setOpenSections((prev) =>
                    navSections.reduce<Record<string, boolean>>((acc, current) => {
                      acc[current.title] =
                        current.title === section.title ? !prev[section.title] : false;
                      return acc;
                    }, {})
                  )
                }
                className="flex w-full items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400 mb-2"
              >
                <span className="flex items-center gap-2">
                  <Icon name={section.icon} className="text-slate-400" />
                  {t(section.title)}
                </span>
                <span
                  className={clsx(
                    "transition-transform duration-200 ease-out",
                    isOpen ? "rotate-180" : "rotate-0"
                  )}
                >
                  ▾
                </span>
              </button>
              <div
                className={clsx(
                  "space-y-1 overflow-hidden transition-all duration-200 ease-out",
                  isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                )}
              >
                {section.items.map((item, index) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-out",
                      pathname === item.href
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                    style={{
                      transitionDelay: isOpen ? `${index * 40}ms` : "0ms",
                      opacity: isOpen ? 1 : 0,
                      transform: isOpen ? "translateY(0)" : "translateY(-4px)"
                    }}
                  >
                    <Icon name={item.icon} className="text-slate-500" />
                    {t(item.label)}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
        </nav>

        <div className="pt-6 border-t border-slate-200">
          <label className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
            {t("Idioma")}
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { key: "es", label: "Español", short: "ES", flag: "🇨🇱" },
              { key: "en", label: "English", short: "EN", flag: "🇺🇸" },
              { key: "pt", label: "Português", short: "PT", flag: "🇧🇷" }
            ].map((option) => {
              const active = locale === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setLocale(option.key as "es" | "en" | "pt")}
                  className={clsx(
                    "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                    active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                  title={t(option.label)}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-[12px]">
                    {option.flag}
                  </span>
                  <span className="text-[11px] font-semibold tracking-[0.18em]">{option.short}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
