import Link from "next/link";
import PageHeader from "@/components/PageHeader";

const cards = [
  {
    title: "Cenas",
    description: "Planifica cupos nocturnos y control de asistencia.",
    href: "/operations/food/cenas"
  },
  {
    title: "Almuerzos",
    description: "Control diario de servicio y contingencias.",
    href: "/operations/food/almuerzos"
  },
  {
    title: "Lugares de comida",
    description: "Gestión de recintos, horarios y capacidad.",
    href: "/operations/food/lugares"
  }
];

export default function FoodOperationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Alimentación"
        description="Submódulo operativo para coordinar servicios de comida por delegación y evento."
      />
      <section className="surface rounded-3xl p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operación</p>
              <h3 className="mt-2 font-display text-2xl text-ink">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{card.description}</p>
              <Link href={card.href} className="mt-4 inline-flex text-sm font-semibold text-emerald-700">
                Abrir módulo
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
