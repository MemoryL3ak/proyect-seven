"use client";

import StatCard from "@/components/StatCard";
import { useI18n } from "@/lib/i18n";

export default function DashboardPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-8">
      <section className="surface rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{t("Centro de control")}</p>
            <h3 className="font-display text-3xl text-ink mt-2">{t("Estado general del evento")}</h3>
            <p className="text-sm text-slate-500 mt-3">
              {t("Monitorea llegadas, asignaciones y cambios operativos en un solo tablero. Este resumen conecta los módulos de transporte, hotelería y usuarios en tiempo real.")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="badge badge-emerald">{t("Operativo")}</div>
            <div className="badge badge-slate">{t("Multievento")}</div>
          </div>
        </div>
      </section>

      <section className="card-grid">
        <StatCard title={t("Llegadas a tiempo")} value="94%" helper={t("12 delegaciones recibidas hoy")} />
        <StatCard title={t("Cambios trazados")} value="32" helper={t("Ultimas 24 horas")} />
        <StatCard title={t("Asignaciones activas")} value="18" helper={t("Vehiculos y habitaciones")} />
        <StatCard title={t("Reclamos")} value="2" helper={t("Pendientes de cierre")} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="surface rounded-3xl p-6">
          <h4 className="font-display text-2xl text-ink">{t("Prioridades operativas")}</h4>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>{t("Revisar la roaming list de la delegación CAN y cerrar asignaciones de habitaciones.")}</li>
            <li>{t("Validar cambio de ruta para vehículo 23 por congestión en el acceso norte.")}</li>
            <li>{t("Coordinar el pre check-in digital con el hotel central para 2 delegaciones.")}</li>
          </ul>
        </div>
        <div className="surface rounded-3xl p-6">
          <h4 className="font-display text-2xl text-ink">{t("KPIs clave")}</h4>
          <div className="mt-4 space-y-4 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>{t("Tiempo promedio de asignacion")}</span>
              <strong className="text-ink">18 min</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("Adopcion App Conductor")}</span>
              <strong className="text-ink">76%</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("Servicios extra controlados")}</span>
              <strong className="text-ink">92%</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("Reclamos por logística")}</span>
              <strong className="text-ink">-38%</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
