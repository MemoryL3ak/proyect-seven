import PageHeader from "@/components/PageHeader";

export default function FoodLunchesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Almuerzos" description="Control de servicio de almuerzo por sede, horario y delegación." />
      <section className="surface rounded-3xl p-6">
        <p className="text-sm text-slate-500">
          Módulo listo para integrar calendario de almuerzos, consumo por bloque y alertas de sobrecupo.
        </p>
      </section>
    </div>
  );
}
