import Link from "next/link";

export default function ScannerOperationsPage() {
  return (
    <div className="space-y-6">
      <section
        className="rounded-3xl border border-slate-300 p-6 text-white shadow-xl"
        style={{ background: "linear-gradient(110deg, #0f172a 0%, #1d4ed8 52%, #0f766e 100%)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/85">Control de acceso</p>
            <h1 className="mt-1 text-3xl font-semibold">Portal de escaneo QR</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85">
              El escaner se abre ahora en una vista independiente, optimizada para telefono y uso operativo en acceso.
            </p>
          </div>
          <Link
            href="/scanner"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-2xl border border-white/35 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/18"
          >
            Abrir portal independiente
          </Link>
        </div>
      </section>

      <section className="surface rounded-3xl p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Uso recomendado</p>
            <p className="mt-3 text-lg font-semibold text-slate-950">Telefono o totem</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Interfaz limpia, full screen y sin menu lateral para operacion continua.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Lugares activos</p>
            <p className="mt-3 text-lg font-semibold text-slate-950">Estadio, Hotel, Gimnasio, Casino</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Cada lectura queda identificada por el lugar seleccionado en pantalla.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Acceso directo</p>
            <p className="mt-3 text-lg font-semibold text-slate-950">`/scanner`</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Puedes abrir esa ruta directamente desde el navegador del telefono.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
