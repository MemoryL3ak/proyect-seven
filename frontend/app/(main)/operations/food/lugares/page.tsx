import PageHeader from "@/components/PageHeader";

export default function FoodLocationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Lugares de comida" description="Gestión de recintos de alimentación, aforo y franjas horarias." />
      <section className="surface rounded-3xl p-6">
        <p className="text-sm text-slate-500">
          Módulo listo para integrar alta de recintos, turnos y reglas de operación por evento.
        </p>
      </section>
    </div>
  );
}
