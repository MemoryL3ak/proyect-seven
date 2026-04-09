"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { title: string; icon: string; items: NavItem[] };
type NavSection = { title: string; icon: string; items?: NavItem[]; groups?: NavGroup[]; href?: string };

const navSections: NavSection[] = [
  {
    title: "Dashboard", icon: "dashboard",
    items: [
      { href: "/dashboard/comercial", label: "Dashboard Comercial", icon: "dashboard" },
      { href: "/dashboard/operacional", label: "Dashboard Operacional", icon: "dashboard" }
    ]
  },
  {
    title: "Registro", icon: "stack",
    items: [
      { href: "/registro/eventos", label: "Registro Evento", icon: "calendar" },
      { href: "/registro/participantes", label: "Inscripción Participantes", icon: "users" },
      { href: "/registro/proveedores", label: "Proveedores", icon: "provider" }
    ]
  },
  {
    title: "Operación", icon: "route",
    groups: [
      {
        title: "Arribos & Llegadas", icon: "and",
        items: [
          { href: "/operacion/and", label: "AND", icon: "and" },
          { href: "/operacion/cumplimiento-and", label: "Cumplimiento AND", icon: "shield" },
          { href: "/operations/flights", label: "Monitor de Vuelos", icon: "flight" }
        ]
      },
      {
        title: "Transporte", icon: "route",
        items: [
          { href: "/operations/vehicle-positions", label: "Tracking de Viajes", icon: "pin" },
          { href: "/operations/trips", label: "Viajes", icon: "route" },
          { href: "/operations/driver-heatmap", label: "Panel Conductores", icon: "driver" },
          { href: "/scanner", label: "Escáner QR", icon: "scan" }
        ]
      },
      {
        title: "Hotelería", icon: "hotel",
        items: [
          { href: "/operations/hotel-tracking", label: "Tracking Hotelería", icon: "hotel" },
          { href: "/masters/accommodations", label: "Hoteles/Villa Panamerica", icon: "hotel" },
          { href: "/masters/hotel-rooms", label: "Habitaciones", icon: "hotel" },
          { href: "/operations/hotel-assignments", label: "Asignaciones Hotel", icon: "hotel" },
          { href: "/operations/hotel-keys", label: "Gestión de llaves", icon: "hotel" },
          { href: "/operations/salones", label: "Reserva de salones", icon: "salon" },
          { href: "/operations/hotel-extras", label: "Reserva de Extras", icon: "extras" }
        ]
      },
      {
        title: "Alimentación", icon: "food",
        items: [
          { href: "/operations/food/tipos", label: "Tipos de Alimentación", icon: "food" },
          { href: "/operations/food/desayuno", label: "Desayuno", icon: "food" },
          { href: "/operations/food/cenas", label: "Cenas", icon: "food" },
          { href: "/operations/food/almuerzos", label: "Almuerzos", icon: "food" },
          { href: "/operations/food/lugares", label: "Lugares de comida", icon: "pin" }
        ]
      },
      {
        title: "Salud", icon: "health-cross",
        items: [{ href: "/health", label: "Salud", icon: "health-cross" }]
      }
    ]
  },
  { title: "Clientes", icon: "users", href: "/clientes" },
  { title: "Deportes", icon: "sports-rings", href: "/deportes" },
  { title: "Sede", icon: "pin", href: "/sede" },
  { title: "Calendario Operacional", icon: "calendar", href: "/sports-calendar" },
  { title: "Acreditación", icon: "shield", href: "/accreditations" },
  {
    title: "Portales", icon: "portal",
    items: [
      { href: "/portal/user", label: "Portal de usuario", icon: "athlete" },
      { href: "/portal/conductor", label: "Portal Conductor", icon: "driver" },
      { href: "/portal/vehicle-request", label: "Solicitud de vehículo", icon: "route" }
    ]
  },
  {
    title: "Administración", icon: "admin",
    items: [
      { href: "/admin/usuarios", label: "Gestión de Usuarios", icon: "users-admin" }
    ]
  },
  { title: "Ayuda", icon: "help", href: "/ayuda" }
];

function Icon({ name, className }: { name: string; className?: string }) {
  const base = "w-[17px] h-[17px] shrink-0";
  switch (name) {
    case "dashboard": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></svg>);
    case "calendar": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 9h18" /></svg>);
    case "users": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5" /><path d="M14 20c0-2 1.5-3.5 3.5-3.5S21 18 21 20" /></svg>);
    case "hotel": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" /></svg>);
    case "athlete": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="7" r="3" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>);
    case "driver": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="7" /><path d="M12 5v4M5 12h4M15 12h4M12 15v4" /></svg>);
    case "route": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6c3 0 3 4 6 4s3-4 6-4" /><path d="M6 18c3 0 3-4 6-4s3 4 6 4" /></svg>);
    case "pin": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 22s6-6 6-11a6 6 0 0 0-12 0c0 5 6 11 6 11z" /><circle cx="12" cy="11" r="2" /></svg>);
    case "shield": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" /></svg>);
    case "health-cross": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 7v10M7 12h10" /></svg>);
    case "food": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 3v8M9 3v8M7.5 11v10" /><path d="M16 3c-2 2-2.5 4.5-2.5 7.5V21" /><path d="M16 3c2 2 2.5 4.5 2.5 7.5" /></svg>);
    case "scan": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 8V5a1 1 0 0 1 1-1h3" /><path d="M20 8V5a1 1 0 0 0-1-1h-3" /><path d="M4 16v3a1 1 0 0 0 1 1h3" /><path d="M20 16v3a1 1 0 0 1-1 1h-3" /><path d="M7 12h10" /><path d="M12 7v10" /></svg>);
    case "stack": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>);
    case "portal": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 12h8M12 8v8" /></svg>);
    case "sports-rings": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6.2" cy="9.2" r="3.1" /><circle cx="12" cy="9.2" r="3.1" /><circle cx="17.8" cy="9.2" r="3.1" /><circle cx="9.1" cy="14.8" r="3.1" /><circle cx="14.9" cy="14.8" r="3.1" /></svg>);
    case "admin": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" /><path d="M9 12l2 2 4-4" /></svg>);
    case "users-admin": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5" /><path d="M14 20c0-2 1.5-3.5 3.5-3.5S21 18 21 20" /><path d="M19 4l2 2-5 5-2-2" /></svg>);
    case "salon": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20" /><path d="M6 6V4M18 6V4" /><path d="M8 14h8M8 17h5" /></svg>);
    case "extras": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>);
    case "provider": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /><path d="M3 12h18" /></svg>);
    case "help": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5" /><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" /></svg>);
    case "flight": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-2-5.5-.5L10 5 1.8 6.2l2.4 2.4L9 9l-4.5 4.5L5 15l2-1 1 2-1 2 2 .5 4.5-4.5.8 4.7 2.4 2.5z" /></svg>);
    case "and": return (<svg className={clsx(base, className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" /><rect x="9" y="11" width="14" height="10" rx="2" /><path d="M13 16l2 2 4-4" /></svg>);
    default: return null;
  }
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: "transform 220ms ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function sectionHasActivePath(section: NavSection, pathname: string) {
  if (section.href && pathname === section.href) return true;
  if (section.items?.some((item) => pathname === item.href)) return true;
  if (section.groups?.some((group) => group.items.some((item) => pathname === item.href))) return true;
  return false;
}

const TEAL = "#21D0B3";
const TEAL_MID = "#34F3C6";

const activeItemStyle = {
  color: "#ffffff",
  background: "rgba(33,208,179,0.22)",
  borderLeft: `3px solid ${TEAL}`,
  fontWeight: 600,
  boxShadow: "inset 0 0 0 1px rgba(33,208,179,0.18)",
} as const;

const inactiveItemStyle = {
  color: "rgba(255,255,255,0.58)",
  background: "transparent",
  borderLeft: "3px solid transparent",
  fontWeight: 400,
} as const;

export default function SideNav({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const activeSection = navSections.find((s) => sectionHasActivePath(s, pathname));
    if (!activeSection) return;
    setOpenSections((prev) => {
      const next: Record<string, boolean> = {};
      navSections.forEach((s) => { next[s.title] = s.title === activeSection.title; });
      return { ...prev, ...next };
    });
  }, [pathname]);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      navSections.forEach((section) => {
        section.groups?.forEach((group) => {
          const hasActiveItem = group.items.some((item) => pathname === item.href);
          const key = `${section.title}::${group.title}`;
          if (hasActiveItem) next[key] = true;
          else if (!(key in next)) next[key] = false;
        });
      });
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    setOpenSections((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return navSections.reduce<Record<string, boolean>>((acc, s) => {
        acc[s.title] = s.title === "Dashboard";
        return acc;
      }, {});
    });
  }, []);

  return (
    <aside className="h-screen sticky top-0 flex flex-col shrink-0" style={{
      width: collapsed ? "68px" : "256px",
      transition: "width 240ms cubic-bezier(0.4,0,0.2,1)",
      background: "linear-gradient(175deg, #1F2E40 0%, #263545 55%, #1B2B3A 100%)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Ambient teal glow — top */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 0, pointerEvents: "none",
        height: "220px",
        background: "radial-gradient(ellipse 100% 180% at 30% -10%, rgba(33,208,179,0.18) 0%, transparent 65%)",
      }} />

      {/* Ambient blue glow — bottom */}
      <div style={{
        position: "absolute", bottom: 0, right: 0, zIndex: 0, pointerEvents: "none",
        width: "200px", height: "200px",
        background: "radial-gradient(ellipse, rgba(31,205,255,0.14) 0%, transparent 70%)",
      }} />

      {/* Right edge shimmer */}
      <div style={{
        position: "absolute", top: "15%", right: 0, zIndex: 0, pointerEvents: "none",
        width: "1px", height: "55%",
        background: "linear-gradient(to bottom, transparent, rgba(33,208,179,0.4), transparent)",
      }} />

      {/* ── Logo / Brand header */}
      <div style={{
        position: "relative", zIndex: 1, flexShrink: 0,
        padding: collapsed ? "16px 0" : "18px 20px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        transition: "padding 240ms cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}>
        {/* Logo glow bloom */}
        <div style={{
          position: "absolute", top: "-20px", left: "-20px",
          width: "140px", height: "100px",
          background: "radial-gradient(ellipse, rgba(33,208,179,0.18) 0%, transparent 70%)",
          pointerEvents: "none", filter: "blur(8px)",
        }} />
        <img
          src="/branding/LOGO-SEVEN-4.png"
          alt="Seven Arena"
          style={{
            height: collapsed ? "32px" : "52px",
            width: "auto", objectFit: "contain",
            transition: "height 240ms cubic-bezier(0.4,0,0.2,1), opacity 180ms ease",
            filter: "drop-shadow(0 0 10px rgba(33,208,179,0.25)) drop-shadow(0 2px 6px rgba(0,0,0,0.4))",
            opacity: collapsed ? 0 : 1,
            position: collapsed ? "absolute" : "relative",
          }}
        />
        {/* Collapsed: icon-only version */}
        {collapsed && (
          <img
            src="/branding/LOGO-SEVEN-3.png"
            alt="Seven Arena"
            style={{
              height: "34px", width: "auto", objectFit: "contain",
              filter: "drop-shadow(0 0 8px rgba(33,208,179,0.3))",
            }}
          />
        )}
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="md:flex hidden"
          style={{
            width: "26px", height: "26px", borderRadius: "8px", flexShrink: 0,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.45)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 150ms, color 150ms",
            ...(collapsed ? { marginTop: "0", position: "relative" } : {}),
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(33,208,179,0.15)"; (e.currentTarget as HTMLElement).style.color = "#21D0B3"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            {collapsed
              ? <><polyline points="9 18 15 12 9 6"/></>
              : <><polyline points="15 18 9 12 15 6"/></>
            }
          </svg>
        </button>
      </div>

      {/* ── Nav */}
      <nav className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", position: "relative", zIndex: 1, padding: "8px 0" }}>
        {navSections.map((section, sectionIdx) => {
          if (section.href) {
            const isActive = pathname === section.href || pathname.startsWith(section.href + "/");
            return (
              <Link
                key={section.title}
                href={section.href}
                onClick={onClose}
                className="flex items-center gap-2.5 mx-2 px-3 py-2 text-[13px] transition-all duration-150"
                style={{
                  ...(isActive ? activeItemStyle : inactiveItemStyle),
                  borderRadius: "8px",
                  marginBottom: "1px",
                  textDecoration: "none",
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.58)";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                <Icon name={section.icon} />
                {!collapsed && <span>{t(section.title)}</span>}
              </Link>
            );
          }

          const isOpen = !!openSections[section.title];
          const sectionActive = sectionHasActivePath(section, pathname);

          return (
            <div key={section.title} style={{ marginBottom: "2px" }}>
              {/* Section separator line for non-first sections */}
              {sectionIdx > 0 && (
                <div style={{
                  margin: "4px 16px 4px",
                  height: "1px",
                  background: "linear-gradient(to right, rgba(255,255,255,0.06), rgba(255,255,255,0.02), transparent)",
                }} />
              )}

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
                className="flex w-full items-center justify-between px-3 py-2 transition-all duration-150"
                style={{
                  margin: "0 8px",
                  width: "calc(100% - 16px)",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  background: sectionActive ? "rgba(33,208,179,0.1)" : "transparent",
                  color: sectionActive ? TEAL_MID : "rgba(255,255,255,0.75)",
                  fontSize: "13px",
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                }}
              >
                <span className="flex items-center gap-2.5">
                  <Icon name={section.icon} />
                  {!collapsed && t(section.title)}
                </span>
                {!collapsed && <span style={{ color: sectionActive ? "rgba(52,243,198,0.7)" : "rgba(255,255,255,0.25)" }}>
                  <Chevron open={isOpen} />
                </span>}
              </button>

              <div style={{
                overflow: "hidden",
                maxHeight: (isOpen && !collapsed) ? "900px" : "0px",
                opacity: (isOpen && !collapsed) ? 1 : 0,
                transition: "max-height 300ms ease, opacity 200ms ease",
              }}>
                <div style={{ padding: "4px 8px 6px", display: "flex", flexDirection: "column", gap: "1px" }}>
                  {section.items?.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link key={item.href} href={item.href}
                        onClick={onClose}
                        className="flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] transition-all duration-150"
                        style={{
                          ...(active ? activeItemStyle : inactiveItemStyle),
                          borderRadius: "7px",
                          textDecoration: "none",
                        }}
                        onMouseEnter={e => {
                          if (!active) {
                            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.82)";
                            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                          }
                        }}
                        onMouseLeave={e => {
                          if (!active) {
                            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.58)";
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                          }
                        }}
                      >
                        <Icon name={item.icon} />
                        {t(item.label)}
                      </Link>
                    );
                  })}

                  {section.groups?.map((group) => {
                    const groupActive = group.items.some((i) => pathname === i.href);
                    const groupKey = `${section.title}::${group.title}`;
                    const isGroupOpen = !!openGroups[groupKey];
                    return (
                      <div key={group.title}>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))
                          }
                          className="flex w-full items-center justify-between px-3 py-1.5 text-[12.5px] transition-all duration-150"
                          style={{
                            borderRadius: "7px",
                            border: "none",
                            cursor: "pointer",
                            background: groupActive ? "rgba(33,208,179,0.1)" : "transparent",
                            color: groupActive ? TEAL_MID : "rgba(255,255,255,0.65)",
                            fontWeight: 600,
                            width: "100%",
                          }}
                        >
                          <span className="flex items-center gap-2.5">
                            <Icon name={group.icon} />
                            {t(group.title)}
                          </span>
                          <span style={{ color: groupActive ? "rgba(52,243,198,0.7)" : "rgba(255,255,255,0.25)" }}>
                            <Chevron open={isGroupOpen} />
                          </span>
                        </button>

                        <div style={{
                          overflow: "hidden",
                          maxHeight: isGroupOpen ? "520px" : "0px",
                          opacity: isGroupOpen ? 1 : 0,
                          transition: "max-height 240ms ease, opacity 160ms ease",
                        }}>
                          {/* Indent connector */}
                          <div style={{
                            margin: "3px 0 3px 20px",
                            paddingLeft: "12px",
                            borderLeft: "1px solid rgba(33,208,179,0.2)",
                            display: "flex", flexDirection: "column", gap: "1px",
                          }}>
                            {group.items.map((item) => {
                              const active = pathname === item.href;
                              return (
                                <Link key={item.href} href={item.href}
                                  onClick={onClose}
                                  className="flex items-center gap-2.5 px-2 py-1.5 text-[12px] transition-all duration-150"
                                  style={{
                                    ...(active ? activeItemStyle : inactiveItemStyle),
                                    borderRadius: "6px",
                                    textDecoration: "none",
                                  }}
                                  onMouseEnter={e => {
                                    if (!active) {
                                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.82)";
                                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                                    }
                                  }}
                                  onMouseLeave={e => {
                                    if (!active) {
                                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.58)";
                                      (e.currentTarget as HTMLElement).style.background = "transparent";
                                    }
                                  }}
                                >
                                  <Icon name={item.icon} />
                                  {t(item.label)}
                                </Link>
                              );
                            })}
                          </div>
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

      {/* ── Language switcher */}
      <div style={{
        flexShrink: 0, padding: collapsed ? "10px 8px 12px" : "12px 12px 14px",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        position: "relative", zIndex: 1,
        transition: "padding 240ms cubic-bezier(0.4,0,0.2,1)",
      }}>
        {!collapsed && (
          <p style={{
            fontSize: "9.5px", textTransform: "uppercase", letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.22)", fontWeight: 600, marginBottom: "8px", paddingLeft: "2px"
          }}>
            {t("Idioma")}
          </p>
        )}
        {collapsed ? (
          /* Collapsed: only active locale, centered */
          <div style={{ display: "flex", justifyContent: "center" }}>
            {[
              { key: "es", label: "Español", short: "ES", flag: "🇨🇱" },
              { key: "en", label: "English", short: "EN", flag: "🇺🇸" },
              { key: "pt", label: "Português", short: "PT", flag: "🇧🇷" }
            ].map((option) => {
              const active = locale === option.key;
              if (!active) return null;
              return (
                <button key={option.key} type="button" onClick={() => {
                  const opts = ["es", "en", "pt"] as const;
                  const next = opts[(opts.indexOf(option.key as "es" | "en" | "pt") + 1) % 3];
                  setLocale(next);
                }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "3px",
                    borderRadius: "8px", padding: "5px 6px",
                    fontSize: "10px", fontWeight: 700,
                    cursor: "pointer",
                    background: "rgba(33,208,179,0.18)",
                    color: TEAL_MID,
                    border: "1px solid rgba(33,208,179,0.35)",
                    width: "100%",
                  }}
                  title={t(option.label)}
                >
                  <span style={{ fontSize: "12px" }}>{option.flag}</span>
                  <span>{option.short}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            {[
              { key: "es", label: "Español", short: "ES", flag: "🇨🇱" },
              { key: "en", label: "English", short: "EN", flag: "🇺🇸" },
              { key: "pt", label: "Português", short: "PT", flag: "🇧🇷" }
            ].map((option) => {
              const active = locale === option.key;
              return (
                <button key={option.key} type="button" onClick={() => setLocale(option.key as "es" | "en" | "pt")}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                    borderRadius: "7px", padding: "5px 4px",
                    fontSize: "11px", fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    background: active ? "rgba(33,208,179,0.2)" : "rgba(255,255,255,0.05)",
                    color: active ? TEAL_MID : "rgba(255,255,255,0.35)",
                    border: `1px solid ${active ? "rgba(33,208,179,0.4)" : "rgba(255,255,255,0.07)"}`,
                    boxShadow: active ? `0 0 12px rgba(33,208,179,0.2), inset 0 1px 0 rgba(52,243,198,0.1)` : "none",
                  }}
                  title={t(option.label)}
                >
                  <span style={{ fontSize: "13px" }}>{option.flag}</span>
                  <span>{option.short}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
