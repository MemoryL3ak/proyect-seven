"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function formatTimestamp(value: Date) {
  return value.toLocaleString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AccreditationScanPage() {
  const searchParams = useSearchParams();
  const [scannedAt, setScannedAt] = useState("");
  const [scanAddress, setScanAddress] = useState("");

  useEffect(() => {
    setScannedAt(formatTimestamp(new Date()));
    setScanAddress(window.location.href);
  }, []);

  const fullName = searchParams.get("name") || "Sin nombre";
  const delegation = searchParams.get("delegation") || "Sin delegacion";
  const discipline = searchParams.get("discipline") || "Sin disciplina";
  const eventName = searchParams.get("event") || "Evento";

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#eff4fb_0%,#dce7f5_100%)] px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
        <div className="bg-[linear-gradient(135deg,#1d4ed8_0%,#0f766e_100%)] px-8 py-8 text-white">
          <p className="text-xs uppercase tracking-[0.3em] text-white/80">Validacion de credencial</p>
          <h1 className="mt-2 text-3xl font-semibold">Datos del escaneo</h1>
          <p className="mt-2 text-sm text-white/80">Resultado generado al abrir el QR de la acreditacion.</p>
        </div>

        <div className="grid gap-5 px-8 py-8 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Fecha y hora escaneo</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{scannedAt || "Cargando..."}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Direccion escaneo (totem)</p>
            <p className="mt-3 break-all text-base font-medium text-slate-800">{scanAddress || "Cargando..."}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Nombre</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{fullName}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Delegacion</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{delegation}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Disciplina</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{discipline}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Evento</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{eventName}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
