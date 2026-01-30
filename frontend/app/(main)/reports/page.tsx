import PageHeader from "@/components/PageHeader";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Consolidación y cierre operativo con KPIs principales."
      />

      <section className="surface rounded-2xl p-6">
        <h4 className="font-display text-xl text-ink">Cierre de operacion</h4>
        <p className="text-sm text-slate-500 mt-2">
          Genera un resumen global de delegaciones, transporte y hotelería. Integra los reportes de
          cumplimiento, cambios y pasajeros finalizados.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pasajeros</p>
            <p className="font-display text-2xl text-ink">1.248</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Servicios extra</p>
            <p className="font-display text-2xl text-ink">14</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cumplimiento</p>
            <p className="font-display text-2xl text-ink">96%</p>
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl p-6">
        <h4 className="font-display text-xl text-ink">Siguientes pasos</h4>
        <ul className="mt-4 space-y-3 text-sm text-slate-600">
          <li>Integrar con GPS para tracking continuo y alertas automaticas.</li>
          <li>Conectar con motor de IA para optimizacion dinamica de rutas.</li>
          <li>Agregar exportacion CSV y PDF para informes de cierre.</li>
        </ul>
      </section>
    </div>
  );
}
