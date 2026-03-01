import { Suspense } from "react";
import AccreditationScanClient from "./scan-client";

export default function AccreditationScanPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[linear-gradient(180deg,#eff4fb_0%,#dce7f5_100%)] px-4 py-10 text-slate-900">
          <section className="mx-auto max-w-3xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
            <div className="bg-[linear-gradient(135deg,#1d4ed8_0%,#0f766e_100%)] px-8 py-8 text-white">
              <p className="text-xs uppercase tracking-[0.3em] text-white/80">Validacion de credencial</p>
              <h1 className="mt-2 text-3xl font-semibold">Datos del escaneo</h1>
            </div>
            <div className="px-8 py-10 text-center text-slate-500">Cargando escaneo...</div>
          </section>
        </main>
      }
    >
      <AccreditationScanClient />
    </Suspense>
  );
}
