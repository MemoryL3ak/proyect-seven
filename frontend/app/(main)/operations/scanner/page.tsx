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

const SCAN_LOCATIONS: Array<{ value: ScanLocation; label: string }> = [
  { value: "ESTADIO", label: "Estadio" },
  { value: "HOTEL", label: "Hotel" },
  { value: "GIMNASIO", label: "Gimnasio" },
  { value: "CASINO", label: "Casino" },
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

export default function ScannerPage() {
  const regionId = useMemo(() => `qr-reader-${Math.random().toString(36).slice(2, 10)}`, []);
  const scannerRef = useRef<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<ScanLocation>("ESTADIO");
  const [scannerReady, setScannerReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualValue, setManualValue] = useState("");
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

  const applyScan = (rawValue: string) => {
    const parsed = parseCredentialQr(rawValue);
    const scannedAt = formatScanTimestamp(new Date());
    const record: ScanRecord = {
      ...parsed,
      location: selectedLocation,
      scannedAt,
    };

    setCurrentScan(record);
    setHistory((prev) => [record, ...prev].slice(0, 8));
    setError(null);
    setManualValue(rawValue);
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
        () => undefined
      );
      setScanning(true);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "No se pudo iniciar la camara.");
    }
  };

  const processManualValue = () => {
    try {
      applyScan(manualValue.trim());
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "No se pudo interpretar el QR.");
    }
  };

  return (
    <div className="space-y-6">
      <section
        className="rounded-3xl border border-slate-300 p-6 text-white shadow-xl"
        style={{ background: "linear-gradient(110deg, #0f172a 0%, #1d4ed8 52%, #0f766e 100%)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/85">Control de acceso</p>
            <h1 className="mt-1 text-3xl font-semibold">Modulo de escaneo de credenciales</h1>
            <p className="mt-1 text-sm text-white/85">Selecciona el lugar, abre la camara y valida el QR de la credencial.</p>
          </div>
          <div className="rounded-2xl border border-white/35 bg-black/20 px-4 py-3 text-sm">
            Lugares activos: {SCAN_LOCATIONS.map((item) => item.label).join(" / ")}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="surface rounded-3xl p-6">
          <div className="grid gap-4 md:grid-cols-[240px_1fr] md:items-end">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Lugar de escaneo</span>
              <select className="input" value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value as ScanLocation)}>
                {SCAN_LOCATIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary" type="button" disabled={!scannerReady || scanning} onClick={() => void startScanner()}>
                {scanning ? "Escaneando..." : "Iniciar camara"}
              </button>
              <button className="btn btn-ghost" type="button" disabled={!scanning} onClick={() => void stopScanner()}>
                Detener camara
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-slate-950/95 p-4">
            <div id={regionId} className="mx-auto min-h-[320px] w-full max-w-[420px] overflow-hidden rounded-2xl bg-slate-900" />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-800">Ingreso manual del QR</p>
            <p className="mt-1 text-sm text-slate-500">Pega el contenido del QR si estas probando sin camara o desde otro dispositivo.</p>
            <textarea
              className="input mt-4 min-h-[110px]"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="Pega aqui la URL codificada en el QR"
            />
            <div className="mt-4">
              <button className="btn btn-primary" type="button" disabled={!manualValue.trim()} onClick={processManualValue}>
                Procesar QR
              </button>
            </div>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        </div>

        <div className="space-y-6">
          <section className="surface rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Ultimo escaneo</p>
            {currentScan ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">Lugar</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-950">{SCAN_LOCATIONS.find((item) => item.value === currentScan.location)?.label}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Fecha y hora escaneo</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{currentScan.scannedAt}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Direccion escaneo</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{SCAN_LOCATIONS.find((item) => item.value === currentScan.location)?.label}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:col-span-2">
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
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                Aun no hay lecturas. Selecciona el lugar y escanea una credencial.
              </div>
            )}
          </section>

          <section className="surface rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Historial reciente</p>
            <div className="mt-4 space-y-3">
              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  Sin escaneos registrados en esta sesion.
                </div>
              ) : (
                history.map((item, index) => (
                  <div key={`${item.rawValue}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{item.fullName}</p>
                        <p className="text-sm text-slate-500">{item.delegation} · {item.discipline}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                        {SCAN_LOCATIONS.find((option) => option.value === item.location)?.label}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{item.scannedAt}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
