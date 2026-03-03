"use client";

import PageHeader from "@/components/PageHeader";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-CL").format(value);

const commercialBuckets = [
  {
    key: "transport",
    label: "Vehiculos",
    awarded: 486_000_000,
    consumed: 318_000_000,
    forecast: 442_000_000,
    tone: "from-sky-500 via-cyan-500 to-teal-400",
  },
  {
    key: "hospitality",
    label: "Hoteleria",
    awarded: 932_000_000,
    consumed: 701_000_000,
    forecast: 884_000_000,
    tone: "from-emerald-500 via-teal-500 to-cyan-500",
  },
  {
    key: "food",
    label: "Alimentacion",
    awarded: 624_000_000,
    consumed: 356_000_000,
    forecast: 598_000_000,
    tone: "from-amber-400 via-orange-400 to-rose-400",
  },
  {
    key: "production",
    label: "Produccion",
    awarded: 278_000_000,
    consumed: 174_000_000,
    forecast: 241_000_000,
    tone: "from-fuchsia-500 via-violet-500 to-indigo-500",
  },
] as const;

const spendByWeek = [
  { label: "Sem 1", amount: 142_000_000 },
  { label: "Sem 2", amount: 198_000_000 },
  { label: "Sem 3", amount: 254_000_000 },
  { label: "Sem 4", amount: 301_000_000 },
  { label: "Sem 5", amount: 355_000_000 },
];

const BudgetMeter = ({
  label,
  awarded,
  consumed,
  forecast,
  tone,
}: {
  label: string;
  awarded: number;
  consumed: number;
  forecast: number;
  tone: string;
}) => {
  const consumptionPct = Math.min(100, Math.round((consumed / awarded) * 100));
  const forecastPct = Math.min(100, Math.round((forecast / awarded) * 100));

  return (
    <article className="rounded-[28px] border border-white/60 bg-white/90 p-5 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
      <div>
        <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">{label}</p>
        <p className="mt-3 text-2xl font-semibold text-slate-950">{formatCurrency(consumed)}</p>
        <p className="mt-1 text-sm text-slate-500">consumido de {formatCurrency(awarded)}</p>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3">
        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Forecast</div>
        <div className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(forecast)}</div>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>% consumido</span>
            <span className="font-semibold text-slate-800">{consumptionPct}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full bg-gradient-to-r ${tone}`} style={{ width: `${consumptionPct}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>% comprometido proyectado</span>
            <span className="font-semibold text-slate-800">{forecastPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-400" style={{ width: `${forecastPct}%` }} />
          </div>
        </div>
      </div>
    </article>
  );
};

const CommercialBarChart = ({
  rows,
}: {
  rows: { label: string; amount: number }[];
}) => {
  const max = Math.max(...rows.map((row) => row.amount), 1);

  return (
    <div className="space-y-4">
      {rows.map((row, index) => {
        const width = Math.max(10, Math.round((row.amount / max) * 100));
        return (
          <div key={row.label} className="grid gap-2 md:grid-cols-[80px_1fr_120px] md:items-center">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {row.label}
            </div>
            <div className="h-11 overflow-hidden rounded-2xl bg-slate-100">
              <div
                className={`flex h-full items-center rounded-2xl px-4 text-sm font-medium text-white shadow-lg ${
                  index % 2 === 0
                    ? "bg-gradient-to-r from-sky-600 via-cyan-500 to-teal-400"
                    : "bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-500"
                }`}
                style={{ width: `${width}%` }}
              >
                {formatCurrency(row.amount)}
              </div>
            </div>
            <div className="text-right text-sm text-slate-500">
              {formatNumber(Math.round(row.amount / 1_000_000))} MM
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function CommercialDashboardPage() {
  const totals = commercialBuckets.reduce(
    (acc, item) => {
      acc.awarded += item.awarded;
      acc.consumed += item.consumed;
      acc.forecast += item.forecast;
      return acc;
    },
    { awarded: 0, consumed: 0, forecast: 0 },
  );

  const consumptionPct = Math.round((totals.consumed / totals.awarded) * 100);
  const forecastPct = Math.round((totals.forecast / totals.awarded) * 100);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard comercial"
        description="Presupuesto, consumo y forecast ficticio de servicios operativos criticos."
      />

      <section className="relative overflow-hidden rounded-[36px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_26%),radial-gradient(circle_at_85%_10%,_rgba(16,185,129,0.18),_transparent_24%),linear-gradient(135deg,_#071a33_0%,_#102d59_48%,_#0f766e_100%)] p-7 text-white shadow-[0_30px_90px_-45px_rgba(15,23,42,0.8)]">
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/60">Control comercial</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">
              Dashboard consumo operacional
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72">
              Vista ejecutiva ficticia para seguir presupuesto adjudicado, ejecucion acumulada y
              proyeccion de cierre por servicio critico.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/55">Adjudicado</div>
                <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.awarded)}</div>
              </div>
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/80">Consumido</div>
                <div className="mt-2 text-2xl font-semibold">{formatCurrency(totals.consumed)}</div>
              </div>
              <div className="rounded-2xl border border-sky-300/30 bg-sky-300/10 px-4 py-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.22em] text-sky-100/80">Uso total</div>
                <div className="mt-2 text-2xl font-semibold">{consumptionPct}%</div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/12 bg-white/8 p-5 backdrop-blur">
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Forecast de cierre</span>
              <span className="font-semibold text-white">{forecastPct}%</span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300"
                style={{ width: `${Math.min(100, forecastPct)}%` }}
              />
            </div>
            <div className="mt-5 text-3xl font-semibold">{formatCurrency(totals.forecast)}</div>
            <p className="mt-2 text-sm leading-6 text-white/68">
              El escenario base proyecta cierre sobre el 92% del presupuesto adjudicado, con presion
              principal en hoteleria y movilidad de ultima milla.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {commercialBuckets.map((bucket) => (
            <BudgetMeter
              key={bucket.key}
              label={bucket.label}
              awarded={bucket.awarded}
              consumed={bucket.consumed}
              forecast={bucket.forecast}
              tone={bucket.tone}
            />
          ))}
        </div>

        <div className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(15,23,42,0.4)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Consumo acumulado</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-950">Tendencia semanal de ejecucion</h2>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Datos ficticios
            </div>
          </div>
          <div className="mt-8">
            <CommercialBarChart rows={spendByWeek} />
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(15,23,42,0.4)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Lectura ejecutiva</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950">Foco de consumo</h2>
          <div className="mt-6 space-y-4">
            {commercialBuckets.map((bucket) => {
              const pct = Math.round((bucket.consumed / bucket.awarded) * 100);
              return (
                <div key={bucket.key}>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span>{bucket.label}</span>
                    <span className="font-semibold text-slate-950">{pct}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${bucket.tone}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
