"use client";

import { usePathname, useRouter } from "next/navigation";
import { clearTokens } from "@/lib/api";
import { humanizePath } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

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
      className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div>
        <p className="section-label mb-2">Panel Operativo</p>
        <h2
          className="font-black text-white"
          style={{ fontSize: "1.75rem", letterSpacing: "-0.025em", lineHeight: 1.1 }}
        >
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Live indicator */}
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.2)",
            color: "#34d399"
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            style={{ animation: "pulseDot 2s ease-in-out infinite" }}
          />
          En vivo
        </div>

        <button
          className="btn btn-ghost text-sm"
          onClick={() => { clearTokens(); router.push("/login"); }}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
