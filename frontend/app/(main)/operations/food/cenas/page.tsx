import PageHeader from "@/components/PageHeader";

export default function FoodDinnersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Cenas" description="Control de cupos, turnos y cumplimiento para servicio de cenas." />
      <section className="surface rounded-3xl p-6">
        <p className="text-sm text-slate-500">
          Módulo listo para integrar reglas de asistencia, cupos por delegación y escaneo QR de acceso.
        </p>
      </section>
    </div>
  );
}
