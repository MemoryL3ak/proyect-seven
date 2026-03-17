"use client";

import { usePathname, useRouter } from "next/navigation";
import { clearTokens } from "@/lib/api";
import { humanizePath } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();

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

  const toggleBtnStyle = isObsidian
    ? {
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "36px", height: "36px", borderRadius: "10px",
        background: "rgba(34,211,238,0.12)",
        border: "1px solid rgba(34,211,238,0.3)",
        cursor: "pointer", transition: "all 150ms ease",
        color: "#22d3ee",
        boxShadow: "0 0 12px rgba(34,211,238,0.2)"
      }
    : theme === "dark"
    ? {
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "36px", height: "36px", borderRadius: "8px",
        background: "#0d1b3e",
        border: "1px solid rgba(201,168,76,0.3)",
        cursor: "pointer", transition: "all 150ms ease",
        color: "#d4a843"
      }
    : {
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "36px", height: "36px", borderRadius: "8px",
        background: "#f1f5f9",
        border: "1px solid #e2e8f0",
        cursor: "pointer", transition: "all 150ms ease",
        color: "#64748b"
      };

  const themeTooltip =
    theme === "dark" ? "Cambiar a tema claro" :
    theme === "light" ? "Cambiar a Obsidian" :
    "Cambiar a tema oscuro";

  return (
    <header
      className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4"
      style={{
        borderBottom: isObsidian
          ? "1px solid rgba(255,255,255,0.06)"
          : "1px solid var(--border-muted)"
      }}
    >
      <div>
        <p
          className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1 flex items-center gap-2"
          style={{ color: isObsidian ? "#22d3ee" : "var(--gold)" }}
        >
          <span
            className="inline-block w-3 h-[2px] rounded-full"
            style={{ background: isObsidian ? "#22d3ee" : "var(--gold)" }}
          />
          Seven Arena · Operations
        </p>
        <h2
          className="font-bold"
          style={{
            fontSize: "1.35rem",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            color: "var(--text)",
            ...(isObsidian ? { textShadow: "0 0 30px rgba(255,255,255,0.1)" } : {})
          }}
        >
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggleTheme}
          title={themeTooltip}
          style={toggleBtnStyle}
        >
          {theme === "obsidian" ? (
            /* Sparkle/Diamond icon — indicates "click to go back to dark" */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5Z" fill="currentColor" opacity="0.9"/>
              <path d="M19 2L19.8 5.2L23 6L19.8 6.8L19 10L18.2 6.8L15 6L18.2 5.2Z" fill="currentColor" opacity="0.6" transform="scale(0.55) translate(16,-2)"/>
            </svg>
          ) : theme === "dark" ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
          style={isObsidian ? {
            background: "rgba(16,185,129,0.12)",
            border: "1px solid rgba(16,185,129,0.3)",
            color: "#10b981",
            boxShadow: "0 0 8px rgba(16,185,129,0.15)"
          } : {
            background: "rgba(22,163,74,0.1)",
            border: "1px solid rgba(63,185,80,0.2)",
            color: "var(--success)"
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isObsidian ? "#10b981" : "var(--success)", animation: "pulseDot 2s ease-in-out infinite" }}
          />
          En vivo
        </div>

        <button
          className="btn btn-ghost text-sm"
          style={isObsidian ? { color: "#64748b", borderColor: "rgba(255,255,255,0.1)" } : { color: "#475569", borderColor: "#cbd5e1" }}
          onClick={() => { clearTokens(); router.push("/login"); }}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
