"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ScanLocation = "ESTADIO" | "HOTEL" | "GIMNASIO" | "CASINO";

type DecodedCredential = {
  fullName: string;
  delegation: string;
  discipline: string;
  eventName: string;
  subjectType: string;
  rawValue: string;
};

type ScanRecord = DecodedCredential & {
  location: ScanLocation;
  scannedAt: string;
};

const SCAN_LOCATIONS: Array<{ value: ScanLocation; label: string; accent: string }> = [
  { value: "ESTADIO", label: "Estadio", accent: "#2563eb" },
  { value: "HOTEL", label: "Hotel", accent: "#0f766e" },
  { value: "GIMNASIO", label: "Gimnasio", accent: "#d97706" },
  { value: "CASINO", label: "Casino", accent: "#7c3aed" },
];

function parseCredentialQr(rawValue: string): DecodedCredential {
  try {
    const url = new URL(rawValue);
    const fullName = url.searchParams.get("name") || "Sin nombre";
    const delegation = url.searchParams.get("delegation") || "Sin delegacion";
    const discipline = url.searchParams.get("discipline") || "Sin disciplina";
    const eventName = url.searchParams.get("event") || "Evento";
    const subjectType = url.searchParams.get("subjectType") || "PARTICIPANT";
    return { fullName, delegation, discipline, eventName, subjectType, rawValue };
  } catch {
    throw new Error("El QR no corresponde a una credencial valida del sistema.");
  }
}

function formatScanTimestamp(date: Date) {
  return date.toLocaleString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ScannerPortal() {
  const regionId = useMemo(() => `qr-reader-${Math.random().toString(36).slice(2, 10)}`, []);
  const scannerRef = useRef<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<ScanLocation>("ESTADIO");
  const [scannerReady, setScannerReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentScan, setCurrentScan] = useState<ScanRecord | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);

  useEffect(() => {
    let active = true;

    async function boot() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!active) return;
      scannerRef.current = new Html5Qrcode(regionId);
      setScannerReady(true);
    }

    void boot();

    return () => {
      active = false;
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (instance?.isScanning) {
        void instance.stop().catch(() => undefined);
      }
      void instance?.clear?.().catch?.(() => undefined);
    };
  }, [regionId]);

  const selectedLocationMeta = SCAN_LOCATIONS.find((item) => item.value === selectedLocation) ?? SCAN_LOCATIONS[0];

  const applyScan = (rawValue: string) => {
    const parsed = parseCredentialQr(rawValue);
    const record: ScanRecord = {
      ...parsed,
      location: selectedLocation,
      scannedAt: formatScanTimestamp(new Date()),
    };

    setCurrentScan(record);
    setHistory((prev) => [record, ...prev].slice(0, 10));
    setError(null);
  };

  const stopScanner = async () => {
    const instance = scannerRef.current;
    if (!instance?.isScanning) return;
    await instance.stop();
    await instance.clear();
    setScanning(false);
  };

  const startScanner = async () => {
    const instance = scannerRef.current;
    if (!instance || scanning) return;

    setError(null);
    try {
      await instance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText: string) => {
          try {
            applyScan(decodedText);
            await stopScanner();
          } catch (scanError) {
            setError(scanError instanceof Error ? scanError.message : "No se pudo interpretar el QR.");
          }
        },
        () => undefined,
      );
      setScanning(true);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "No se pudo iniciar la camara.");
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe_0%,#eef4ff_38%,#f8fafc_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-6">
        <section className="overflow-hidden rounded-[32px] border border-white/60 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_48%,#0f766e_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
          <div className="flex flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl rounded-[24px] bg-slate-950/14 px-1 py-1" style={{ color: "#ffffff" }}>
              <div
                className="inline-flex items-center rounded-full border border-white/35 bg-slate-950/18 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] backdrop-blur"
                style={{ color: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.28)" }}
              >
                Control de acceso
              </div>
              <h1
                className="mt-4 max-w-xl text-[2rem] font-semibold tracking-tight sm:text-[2.35rem] sm:leading-[1.02]"
                style={{ color: "#ffffff", textShadow: "0 2px 10px rgba(0,0,0,0.18)" }}
              >
                Escaneo QR de credenciales
              </h1>
              <p
                className="mt-3 max-w-lg text-sm font-medium leading-6 sm:text-[15px]"
                style={{ color: "rgba(255,255,255,0.92)", textShadow: "0 1px 2px rgba(0,0,0,0.22)" }}
              >
                Selecciona el lugar y escanea la credencial desde una vista optimizada para telefono.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[408px]">
              {SCAN_LOCATIONS.map((item) => {
                const active = item.value === selectedLocation;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSelectedLocation(item.value)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-white/70 bg-white text-slate-950 shadow-lg shadow-slate-950/20"
                        : "border-white/26 bg-white/10 text-white hover:bg-white/16"
                    }`}
                  >
                    <div className={`text-[10px] uppercase tracking-[0.24em] ${active ? "text-slate-500" : "text-white/76"}`}>Lugar</div>
                    <div className="mt-1 text-sm font-semibold sm:text-base">{item.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-5 grid flex-1 gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Camara activa</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">Escaneo en {selectedLocationMeta.label}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-primary" type="button" disabled={!scannerReady || scanning} onClick={() => void startScanner()}>
                    {scanning ? "Escaneando..." : "Iniciar camara"}
                  </button>
                  <button className="btn btn-ghost" type="button" disabled={!scanning} onClick={() => void stopScanner()}>
                    Detener
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div
                className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#020617_0%,#111827_100%)] p-3 sm:p-4"
                style={{ boxShadow: `inset 0 0 0 1px ${selectedLocationMeta.accent}22` }}
              >
                <div className="mb-3 flex items-center justify-between px-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
                  <span>Camara posterior</span>
                  <span className={scanning ? "text-emerald-400" : "text-slate-500"}>{scanning ? "Activa" : "En espera"}</span>
                </div>
                <div
                  id={regionId}
                  className="mx-auto min-h-[320px] w-full overflow-hidden rounded-[22px] bg-slate-900 sm:min-h-[420px]"
                />
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
              <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Ultimo escaneo</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">Resultado de validacion</p>
              </div>
              <div className="p-4 sm:p-6">
                {currentScan ? (
                  <div className="space-y-4">
                    <div
                      className="rounded-[26px] border px-4 py-4 text-white sm:px-5"
                      style={{ background: `linear-gradient(135deg, ${selectedLocationMeta.accent} 0%, #0f172a 100%)` }}
                    >
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/72">Punto de acceso</p>
                      <p className="mt-2 text-2xl font-semibold">{selectedLocationMeta.label}</p>
                      <p className="mt-2 text-sm text-white/80">{currentScan.scannedAt}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Nombre</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{currentScan.fullName}</p>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Delegacion</p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">{currentScan.delegation}</p>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Disciplina</p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">{currentScan.discipline}</p>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Tipo</p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">{currentScan.subjectType === "DRIVER" ? "Conductor" : "Participante"}</p>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Evento</p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">{currentScan.eventName}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[26px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500 sm:p-10">
                    Aun no hay lecturas. Selecciona el lugar y escanea una credencial.
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
              <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Historial</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">Ultimas validaciones</p>
              </div>
              <div className="p-4 sm:p-6">
                <div className="space-y-3">
                  {history.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      Sin escaneos registrados en esta sesion.
                    </div>
                  ) : (
                    history.map((item, index) => (
                      <div key={`${item.rawValue}-${index}`} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">{item.fullName}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {item.delegation} | {item.discipline}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                            {SCAN_LOCATIONS.find((option) => option.value === item.location)?.label}
                          </span>
                        </div>
                        <p className="mt-3 text-xs text-slate-400">{item.scannedAt}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
