"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearTokens, getStoredUser } from "@/lib/api";
import { humanizePath } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export default function TopBar({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [profileName, setProfileName] = useState("Usuario");
  const [profileRole, setProfileRole] = useState("SIN ROL");

  const isHotelMaster =
    pathname.startsWith("/masters/accommodations") ||
    pathname.startsWith("/masters/hotel-rooms");

  const labelMap: Record<string, string> = {
    dashboard: "Dashboard",
    comercial: "Dashboard Comercial",
    operacional: "Dashboard Operacional",
    registro: "Registro",
    inscripcion: "Inscripción",
    participantes: "Participantes",
    operacion: "Operación",
    cumplimiento: "Cumplimiento",
    clientes: "Clientes",
    deportes: "Deportes",
    sede: "Sede",
    food: "Alimentación",
    cenas: "Cenas",
    almuerzos: "Almuerzos",
    lugares: "Lugares de comida",
    users: "Usuarios",
    athletes: "Participantes",
    drivers: "Conductores",
    masters: isHotelMaster ? "Hotelería" : "Maestros",
    accommodations: "Hoteles",
    "and-compliance": "Cumplimiento AND",
    "hotel-rooms": "Habitaciones",
    "hotel-assignments": "Asignaciones hotel",
    "hotel-keys": "Gestión de llaves",
    operations: "Operaciones",
    health: "Salud",
    trips: "Viajes",
    "sports-calendar": "Calendario deportivo",
    "vehicle-positions": "Tracking de viajes",
    accreditations: "Acreditaciones",
    "hotel-tracking": "Tracking hotelería",
    incidents: "Incidentes",
    reports: "Reportes",
    portal: "Portales",
    user: "Portal de usuario",
    conductor: "Portal Conductor"
  };

  const title = humanizePath(pathname, { labels: labelMap, translate: t });

  useEffect(() => {
    const storedUser = getStoredUser();
    const metadata = (storedUser?.user_metadata as Record<string, unknown> | undefined) || {};
    const appMetadata = (storedUser?.app_metadata as Record<string, unknown> | undefined) || {};
    const metadataName = typeof metadata.name === "string" ? metadata.name.trim() : "";
    const metadataRole =
      typeof metadata.role === "string" ? metadata.role.trim() :
      typeof metadata.rol === "string" ? metadata.rol.trim() :
      "";
    const appMetadataRole =
      typeof appMetadata.role === "string" ? appMetadata.role.trim() :
      typeof appMetadata.user_role === "string" ? appMetadata.user_role.trim() :
      "";
    const topLevelRole = typeof storedUser?.role === "string" ? storedUser.role.trim() : "";
    const fallbackName = (storedUser?.email || "Usuario").split("@")[0];
    const resolvedRole =
      metadataRole ||
      appMetadataRole ||
      (topLevelRole && topLevelRole.toLowerCase() !== "authenticated" ? topLevelRole : "") ||
      "SIN ROL";
    setProfileName(metadataName || fallbackName || "Usuario");
    setProfileRole(resolvedRole.toUpperCase());
  }, []);

  const initials = profileName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() || "")
    .join("") || "U";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-5" style={{
      borderBottom: "1px solid #e2e8f0",
    }}>
      {/* Left: hamburger + logo + title */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <button
          type="button"
          className="topbar-hamburger"
          onClick={onMenuOpen}
          aria-label="Abrir menú"
          style={{
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "#f0f3fa",
            border: "1px solid #e2e8f0",
            cursor: "pointer",
            color: "#30455B",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>

        <img
          src="/branding/LOGO-SEVEN-1.png"
          alt="Seven Arena"
          style={{
            height: "32px", width: "auto", objectFit: "contain",
            animation: "logoFloat 5s ease-in-out infinite",
            filter: "drop-shadow(0 2px 6px rgba(15,23,42,0.12))",
          }}
        />
        <div style={{ width: "1px", height: "22px", background: "linear-gradient(to bottom, transparent, #cbd5e1, transparent)" }} />
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: "#0f172a" }}>
            {title}
          </h2>
        </div>
      </div>

      {/* Right: profile + logout */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Profile badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "6px 10px",
          minWidth: "188px",
        }}>
          <div aria-hidden style={{
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            background: "rgba(33,208,179,0.12)",
            color: "#21D0B3",
            display: "grid",
            placeItems: "center",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 700,
              color: "#0f172a",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "128px",
            }} title={profileName}>
              {profileName}
            </p>
            <p style={{
              margin: 0,
              fontSize: "10px",
              fontWeight: 600,
              color: "#64748b",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "128px",
            }} title={profileRole}>
              {profileRole}
            </p>
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={() => { clearTokens(); router.push("/login"); }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            height: "40px",
            padding: "0 14px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            color: "#475569",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 150ms ease",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
