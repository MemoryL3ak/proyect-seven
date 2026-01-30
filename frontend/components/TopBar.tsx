"use client";

import { usePathname, useRouter } from "next/navigation";
import { clearTokens } from "@/lib/api";
import { humanizePath } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  const labelMap: Record<string, string> = {
    users: "Usuarios",
    athletes: "Participantes",
    drivers: "Conductores",
    masters: "Maestros",
    operations: "Operaciones",
    trips: "Viajes",
    "vehicle-positions": "Tracking de viajes",
    "hotel-tracking": "Tracking hotelería",
    incidents: "Incidentes",
    reports: "Reportes",
    portal: "Portales",
    user: "Portal de usuario",
    conductor: "Portal Conductor"
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Panel Operativo</p>
        <h2 className="font-display text-3xl text-ink">
          {humanizePath(pathname, { labels: labelMap, translate: t })}
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="btn btn-ghost"
          onClick={() => {
            clearTokens();
            router.push("/login");
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
