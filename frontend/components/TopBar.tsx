"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearTokens, getStoredUser } from "@/lib/api";
import { humanizePath } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export default function TopBar({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
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
  const isObsidian = theme === "obsidian";
  const isAtlas = theme === "atlas";
  const isDark = theme === "dark";

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

  const renderProfileBadge = (opts: {
    bg: string;
    border: string;
    avatarBg: string;
    avatarColor: string;
    titleColor: string;
    subtitleColor: string;
  }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: opts.bg,
        border: `1px solid ${opts.border}`,
        borderRadius: "12px",
        padding: "6px 10px",
        minWidth: "188px",
      }}
    >
      <div
        aria-hidden
        style={{
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          background: opts.avatarBg,
          color: opts.avatarColor,
          display: "grid",
          placeItems: "center",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.06em",
        }}
      >
        {initials}
      </div>
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            fontWeight: 700,
            color: opts.titleColor,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "128px",
          }}
          title={profileName}
        >
          {profileName}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "10px",
            fontWeight: 600,
            color: opts.subtitleColor,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "128px",
          }}
          title={profileRole}
        >
          {profileRole}
        </p>
      </div>
    </div>
  );

  const renderLogoutButton = (opts: {
    bg: string;
    border: string;
    text: string;
  }) => (
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
        border: `1px solid ${opts.border}`,
        background: opts.bg,
        color: opts.text,
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
        letterSpacing: "0.01em",
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
  );

  const themeTooltip =
    isDark ? "Cambiar a tema claro" :
    theme === "light" ? "Cambiar a Obsidian" :
    isObsidian ? "Cambiar a Atlas" :
    "Cambiar a tema oscuro";

  const ThemeIcon = () => {
    if (isObsidian) return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5Z" fill="currentColor" opacity="0.9"/>
        <path d="M19 2L19.8 5.2L23 6L19.8 6.8L19 10L18.2 6.8L15 6L18.2 5.2Z" fill="currentColor" opacity="0.6" transform="scale(0.55) translate(16,-2)"/>
      </svg>
    );
    if (isAtlas) return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    );
    if (isDark) return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    );
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    );
  };

  const renderHamburger = (color: string, border: string, bg: string) => (
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
        background: bg,
        border: `1px solid ${border}`,
        cursor: "pointer",
        color,
        flexShrink: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M3 6h18M3 12h18M3 18h18" />
      </svg>
    </button>
  );

  /* ── ATLAS ─────────────────────────────────────────────── */
  if (isAtlas) {
    return (
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "64px", position: "relative", overflow: "hidden",
        background: "linear-gradient(105deg, #ffffff 0%, #f5f7ff 50%, #eef2ff 100%)",
      }}>
        {/* Shimmer sweep */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, width: "60px", height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
            animation: "bannerShimmer 4s ease-in-out infinite",
            animationDelay: "2s",
          }} />
          {/* Right decorative arc */}
          <div style={{
            position: "absolute", right: "-60px", top: "-40px",
            width: "200px", height: "200px", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,91,219,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
          {/* Bottom accent line */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg, #3b5bdb 0%, #6481f0 40%, rgba(100,129,240,0.1) 100%)",
          }} />
        </div>

        {/* Left: Logo + divider + breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "0", position: "relative", zIndex: 1 }}>
          {renderHamburger("#3b5bdb", "#c7d2fe", "#eef2ff")}
          <img
            src="/branding/LOGO-SEVEN-2.png"
            alt="Seven Arena"
            style={{
              height: "36px", width: "auto", objectFit: "contain",
              animation: "logoFloat 4s ease-in-out infinite, logoGlowAtlas 3s ease-in-out infinite",
            }}
          />
          <div style={{ width: "1px", height: "26px", background: "linear-gradient(to bottom, transparent, #c7d2fe, transparent)", margin: "0 18px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span style={{ fontSize: "10px", color: "#6481f0", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Seven Arena
            </span>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1 }}>
              {title}
            </span>
          </div>
        </div>

        {/* Right: controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative", zIndex: 1 }}>
          <button type="button" onClick={toggleTheme} title={themeTooltip} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "32px", height: "32px", borderRadius: "8px",
            background: "#eef2ff", border: "1px solid #c7d2fe",
            cursor: "pointer", color: "#3b5bdb", transition: "all 150ms ease",
          }}>
            <ThemeIcon />
          </button>
          {renderProfileBadge({
            bg: "#ffffff",
            border: "#dbe6ff",
            avatarBg: "#e0eaff",
            avatarColor: "#2f4db8",
            titleColor: "#0f172a",
            subtitleColor: "#64748b",
          })}
          {renderLogoutButton({
            bg: "#ffffff",
            border: "#b7c3e2",
            text: "#3f496d",
          })}

          <button
            style={{ display: "none", background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 13px", fontSize: "12px", color: "#64748b", cursor: "pointer" }}
            onClick={() => { clearTokens(); router.push("/login"); }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>
    );
  }

  /* ── OBSIDIAN ───────────────────────────────────────────── */
  if (isObsidian) {
    return (
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-5" style={{
        borderBottom: "1px solid rgba(34,211,238,0.1)",
        position: "relative",
      }}>
        {/* Subtle glow behind logo */}
        <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: "180px", height: "60px", background: "radial-gradient(ellipse, rgba(34,211,238,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "14px", position: "relative", zIndex: 1 }}>
          {renderHamburger("#22d3ee", "rgba(34,211,238,0.3)", "rgba(34,211,238,0.1)")}
          <img
            src="/branding/LOGO-SEVEN-2.png"
            alt="Seven Arena"
            style={{
              height: "32px", width: "auto", objectFit: "contain",
              animation: "logoFloat 5s ease-in-out infinite, logoGlowObsidian 2.5s ease-in-out infinite",
            }}
          />
          <div style={{ width: "1px", height: "22px", background: "linear-gradient(to bottom, transparent, rgba(34,211,238,0.3), transparent)" }} />
          <div>
            <p style={{ fontSize: "10px", color: "#22d3ee", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "2px" }}>
              Seven Arena
            </p>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: "#e2e8f0", textShadow: "0 0 30px rgba(255,255,255,0.1)" }}>
              {title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleTheme} title={themeTooltip} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "32px", height: "32px", borderRadius: "8px",
            background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)",
            cursor: "pointer", color: "#22d3ee", boxShadow: "0 0 12px rgba(34,211,238,0.2)",
          }}>
            <ThemeIcon />
          </button>
          {renderProfileBadge({
            bg: "rgba(15,23,42,0.72)",
            border: "rgba(34,211,238,0.28)",
            avatarBg: "rgba(34,211,238,0.18)",
            avatarColor: "#67e8f9",
            titleColor: "#e2e8f0",
            subtitleColor: "#94a3b8",
          })}
          {renderLogoutButton({
            bg: "rgba(15,23,42,0.72)",
            border: "rgba(34,211,238,0.28)",
            text: "#c5f3fb",
          })}
          <button className="btn btn-ghost text-sm" style={{ display: "none", color: "#64748b", borderColor: "rgba(255,255,255,0.1)" }} onClick={() => { clearTokens(); router.push("/login"); }}>
            Cerrar sesión
          </button>
        </div>
      </header>
    );
  }

  /* ── DARK ───────────────────────────────────────────────── */
  if (isDark) {
    return (
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-5" style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "relative",
      }}>
        <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: "160px", height: "60px", background: "radial-gradient(ellipse, rgba(201,168,76,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "14px", position: "relative", zIndex: 1 }}>
          {renderHamburger("#d4a843", "rgba(201,168,76,0.3)", "#0d1b3e")}
          <img
            src="/branding/LOGO-SEVEN-2.png"
            alt="Seven Arena"
            style={{
              height: "32px", width: "auto", objectFit: "contain",
              animation: "logoFloat 5s ease-in-out infinite, logoGlowDark 3s ease-in-out infinite",
            }}
          />
          <div style={{ width: "1px", height: "22px", background: "linear-gradient(to bottom, transparent, rgba(201,168,76,0.25), transparent)" }} />
          <div>
            <p style={{ fontSize: "10px", color: "var(--gold)", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "2px" }}>
              Seven Arena
            </p>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: "var(--text)" }}>
              {title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleTheme} title={themeTooltip} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "32px", height: "32px", borderRadius: "8px",
            background: "#0d1b3e", border: "1px solid rgba(201,168,76,0.3)",
            cursor: "pointer", color: "#d4a843",
          }}>
            <ThemeIcon />
          </button>
          {renderProfileBadge({
            bg: "rgba(13,27,62,0.78)",
            border: "rgba(201,168,76,0.3)",
            avatarBg: "rgba(201,168,76,0.2)",
            avatarColor: "#f5d68a",
            titleColor: "#f8fafc",
            subtitleColor: "#cbd5e1",
          })}
          {renderLogoutButton({
            bg: "rgba(13,27,62,0.78)",
            border: "rgba(201,168,76,0.3)",
            text: "#f5d68a",
          })}
          <button className="btn btn-ghost text-sm" style={{ display: "none", color: "#475569", borderColor: "#cbd5e1" }} onClick={() => { clearTokens(); router.push("/login"); }}>
            Cerrar sesión
          </button>
        </div>
      </header>
    );
  }

  /* ── LIGHT ──────────────────────────────────────────────── */
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-5" style={{
      borderBottom: "1px solid var(--border-muted)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {renderHamburger("#1e3a8a", "#c7d2fe", "#eef2ff")}
        <img
          src="/branding/LOGO-SEVEN-2.png"
          alt="Seven Arena"
          style={{
            height: "32px", width: "auto", objectFit: "contain",
            animation: "logoFloat 5s ease-in-out infinite",
            filter: "drop-shadow(0 2px 6px rgba(15,23,42,0.15))",
          }}
        />
        <div style={{ width: "1px", height: "22px", background: "linear-gradient(to bottom, transparent, #cbd5e1, transparent)" }} />
        <div>
          <p style={{ fontSize: "10px", color: "var(--brand)", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "2px" }}>
            Seven Arena
          </p>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: "var(--text)" }}>
            {title}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={toggleTheme} title={themeTooltip} style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "32px", height: "32px", borderRadius: "8px",
          background: "#f1f5f9", border: "1px solid #e2e8f0",
          cursor: "pointer", color: "#64748b",
        }}>
          <ThemeIcon />
        </button>
        {renderProfileBadge({
          bg: "#3f496d",
          border: "#566086",
          avatarBg: "#7a84a8",
          avatarColor: "#f8fafc",
          titleColor: "#f8fafc",
          subtitleColor: "#dbe3ff",
        })}
        {renderLogoutButton({
          bg: "#ffffff",
          border: "#b7c3e2",
          text: "#3f496d",
        })}
        <button className="btn btn-ghost text-sm" style={{ display: "none", color: "#475569", borderColor: "#cbd5e1" }} onClick={() => { clearTokens(); router.push("/login"); }}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
