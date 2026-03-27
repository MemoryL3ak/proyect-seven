"use client";

import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useI18n } from "@/lib/i18n";

type Locale = "es" | "en" | "pt";

const CARDS_DATA: Record<Locale, { title: string; description: string; href: string }[]> = {
  es: [
    { title: "Tipos de Alimentación", description: "Distribución de participantes por requerimiento alimentario.", href: "/operations/food/tipos" },
    { title: "Desayuno",              description: "Planificación de menús de desayuno por hotel y fecha.",       href: "/operations/food/desayuno" },
    { title: "Cenas",                 description: "Planificación de menús nocturnos por hotel y fecha.",         href: "/operations/food/cenas" },
    { title: "Almuerzos",             description: "Planificación de menús de almuerzo por hotel y fecha.",       href: "/operations/food/almuerzos" },
    { title: "Lugares de comida",     description: "Gestión de recintos, aforo y tipos de cliente asignados.",    href: "/operations/food/lugares" },
  ],
  en: [
    { title: "Food Types",     description: "Distribution of participants by dietary requirement.",      href: "/operations/food/tipos" },
    { title: "Breakfast",      description: "Breakfast menu planning by hotel and date.",               href: "/operations/food/desayuno" },
    { title: "Dinners",        description: "Evening menu planning by hotel and date.",                  href: "/operations/food/cenas" },
    { title: "Lunches",        description: "Lunch menu planning by hotel and date.",                    href: "/operations/food/almuerzos" },
    { title: "Food Venues",    description: "Venue management, capacity and assigned client types.",     href: "/operations/food/lugares" },
  ],
  pt: [
    { title: "Tipos de Alimentação",   description: "Distribuição de participantes por requisito alimentar.",                   href: "/operations/food/tipos" },
    { title: "Café da manhã",          description: "Planejamento de cardápios de café da manhã por hotel e data.",             href: "/operations/food/desayuno" },
    { title: "Jantares",               description: "Planejamento de cardápios noturnos por hotel e data.",                     href: "/operations/food/cenas" },
    { title: "Almoços",                description: "Planejamento de cardápios de almoço por hotel e data.",                   href: "/operations/food/almuerzos" },
    { title: "Locais de alimentação",  description: "Gestão de locais, lotação e tipos de cliente atribuídos.",                href: "/operations/food/lugares" },
  ],
};

const SECTION_LABEL: Record<Locale, string> = {
  es: "Operación",
  en: "Operations",
  pt: "Operação",
};

const PAGE_TITLE: Record<Locale, string> = {
  es: "Alimentación",
  en: "Food",
  pt: "Alimentação",
};

const PAGE_DESC: Record<Locale, string> = {
  es: "Submódulo operativo para coordinar servicios de comida por delegación y evento.",
  en: "Operations submodule to coordinate food services by delegation and event.",
  pt: "Submódulo operacional para coordenar serviços de alimentação por delegação e evento.",
};

export default function FoodOperationsPage() {
  const { locale, t } = useI18n();
  const loc = locale as Locale;
  const cards = CARDS_DATA[loc];

  return (
    <div className="space-y-6">
      <PageHeader
        title={PAGE_TITLE[loc]}
        description={PAGE_DESC[loc]}
      />
      <section className="surface rounded-3xl p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article key={card.href} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{SECTION_LABEL[loc]}</p>
              <h3 className="mt-2 font-display text-2xl text-ink">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{card.description}</p>
              <Link href={card.href} className="mt-4 inline-flex text-sm font-semibold text-emerald-700">
                {t("Abrir módulo")}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
