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

  return (
    <header
      className="flex flex-wrap items-center justify-between gap-4 mb-7 pb-5"
      style={{ borderBottom: "1px solid var(--border-muted)" }}
    >
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1.5 flex items-center gap-2" style={{ color: "var(--gold)" }}>
          <span className="inline-block w-3 h-[2px] rounded-full" style={{ background: "var(--gold)" }} />
          Seven Arena · Operations
        </p>
        <h2
          className="font-bold"
          style={{ fontSize: "1.45rem", letterSpacing: "-0.02em", lineHeight: 1.2, color: "var(--text)" }}
        >
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "36px", height: "36px", borderRadius: "8px",
            background: theme === "dark" ? "#0d1b3e" : "#f1f5f9",
            border: theme === "dark" ? "1px solid rgba(201,168,76,0.3)" : "1px solid #e2e8f0",
            cursor: "pointer", transition: "all 150ms ease",
            color: theme === "dark" ? "#d4a843" : "#64748b"
          }}
        >
          {theme === "dark" ? (
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
          style={{
            background: "rgba(22,163,74,0.1)",
            border: "1px solid rgba(63,185,80,0.2)",
            color: "var(--success)"
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--success)", animation: "pulseDot 2s ease-in-out infinite" }}
          />
          En vivo
        </div>

        <button
          className="btn btn-ghost text-sm"
          style={{ color: "#475569", borderColor: "#cbd5e1" }}
          onClick={() => { clearTokens(); router.push("/login"); }}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
