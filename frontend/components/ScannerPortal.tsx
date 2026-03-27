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

const SCAN_LOCATIONS: Array<{ value: ScanLocation; label: string; color: string; bg: string; border: string }> = [
  { value: "ESTADIO",  label: "Estadio",  color: "#3b82f6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.3)"  },
  { value: "HOTEL",    label: "Hotel",    color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.3)"  },
  { value: "GIMNASIO", label: "Gimnasio", color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.3)"  },
  { value: "CASINO",   label: "Casino",   color: "#a855f7", bg: "rgba(168,85,247,0.08)",  border: "rgba(168,85,247,0.3)"  },
];

const LOCATION_ICONS: Record<ScanLocation, JSX.Element> = {
  ESTADIO: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 5v14a9 3 0 0 1-18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>
    </svg>
  ),
  HOTEL: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 22V8l9-6 9 6v14"/><path d="M9 22V12h6v10"/><rect x="9" y="7" width="2" height="2"/><rect x="13" y="7" width="2" height="2"/>
    </svg>
  ),
  GIMNASIO: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 12h12"/><path d="M2 9h4"/><path d="M2 15h4"/><path d="M18 9h4"/><path d="M18 15h4"/>
    </svg>
  ),
  CASINO: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
    </svg>
  ),
};

function parseCredentialQr(rawValue: string): DecodedCredential {
  try {
    const url = new URL(rawValue);
    const fullName    = url.searchParams.get("name")        || "Sin nombre";
    const delegation  = url.searchParams.get("delegation")  || "Sin delegacion";
    const discipline  = url.searchParams.get("discipline")  || "Sin disciplina";
    const eventName   = url.searchParams.get("event")       || "Evento";
    const subjectType = url.searchParams.get("subjectType") || "PARTICIPANT";
    return { fullName, delegation, discipline, eventName, subjectType, rawValue };
  } catch {
    throw new Error("El QR no corresponde a una credencial valida del sistema.");
  }
}

function formatScanTimestamp(date: Date) {
  return date.toLocaleString("es-CL", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function ScannerPortal() {
  const regionId   = useMemo(() => `qr-reader-${Math.random().toString(36).slice(2, 10)}`, []);
  const scannerRef = useRef<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<ScanLocation>("ESTADIO");
  const [scannerReady, setScannerReady] = useState(false);
  const [scanning,     setScanning]     = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [currentScan,  setCurrentScan]  = useState<ScanRecord | null>(null);
  const [history,      setHistory]      = useState<ScanRecord[]>([]);
  const [flashOk,      setFlashOk]      = useState(false);

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
      if (instance?.isScanning) void instance.stop().catch(() => undefined);
      void instance?.clear?.()?.catch?.(() => undefined);
    };
  }, [regionId]);

  const loc = SCAN_LOCATIONS.find((l) => l.value === selectedLocation) ?? SCAN_LOCATIONS[0];

  const applyScan = (rawValue: string) => {
    const parsed = parseCredentialQr(rawValue);
    const record: ScanRecord = { ...parsed, location: selectedLocation, scannedAt: formatScanTimestamp(new Date()) };
    setCurrentScan(record);
    setHistory((prev) => [record, ...prev].slice(0, 10));
    setError(null);
    setFlashOk(true);
    setTimeout(() => setFlashOk(false), 1800);
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
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo interpretar el QR.");
          }
        },
        () => undefined,
      );
      setScanning(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la camara.");
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f0f3fa", color: "#0f172a", fontFamily: "inherit" }}>
      <style>{`
        @keyframes scanLine {
          0%   { top: 0%; opacity: 1; }
          48%  { opacity: 1; }
          50%  { top: 100%; opacity: 0; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes successFlash {
          0%   { opacity: 0; transform: scale(0.85); }
          30%  { opacity: 1; transform: scale(1.04); }
          100% { opacity: 0; transform: scale(1.08); }
        }
        @keyframes scannerPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.5; }
        }
      `}</style>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", minHeight: "100vh", gap: "16px" }}>

        {/* ── Header banner */}
        <section style={{
          borderRadius: "24px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          padding: "24px 28px",
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
            <div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "3px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#21D0B3" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#21D0B3", display: "inline-block" }} />
                Control de acceso
              </span>
              <h1 style={{ marginTop: "10px", fontSize: "clamp(1.4rem, 2.5vw, 2rem)", fontWeight: 800, lineHeight: 1.1, color: "#0f172a" }}>
                Escaneo QR de credenciales
              </h1>
              <p style={{ marginTop: "6px", fontSize: "14px", color: "#64748b", maxWidth: "480px" }}>
                Selecciona el lugar y escanea la credencial desde una vista optimizada para telefono.
              </p>
            </div>

            {/* Location pills */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", minWidth: "340px" }}>
              {SCAN_LOCATIONS.map((item) => {
                const active = item.value === selectedLocation;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSelectedLocation(item.value)}
                    style={{
                      borderRadius: "14px",
                      border: active ? `2px solid ${item.color}` : "1px solid #e2e8f0",
                      background: active ? item.bg : "#f8fafc",
                      padding: "10px 8px",
                      cursor: "pointer",
                      transition: "all 200ms",
                      textAlign: "left",
                      boxShadow: active ? `0 2px 12px ${item.border}` : "none",
                    }}
                  >
                    <div style={{ color: active ? item.color : "#94a3b8", marginBottom: "4px" }}>
                      {LOCATION_ICONS[item.value]}
                    </div>
                    <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: active ? item.color : "#94a3b8" }}>Lugar</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: active ? "#0f172a" : "#64748b", marginTop: "2px" }}>{item.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "16px", flex: 1, alignItems: "start" }}>

          {/* Camera panel */}
          <div style={{ borderRadius: "24px", border: "1px solid #e2e8f0", background: "#ffffff", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", overflow: "hidden" }}>
            {/* Panel header */}
            <div style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>Cámara activa</p>
                <p style={{ marginTop: "3px", fontSize: "16px", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: loc.color }}>{LOCATION_ICONS[selectedLocation]}</span>
                  Escaneo en {loc.label}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  disabled={!scannerReady || scanning}
                  onClick={() => void startScanner()}
                  style={{
                    background: scanning ? loc.bg : `linear-gradient(135deg, #21D0B3, #14AE98)`,
                    border: scanning ? `1px solid ${loc.border}` : "none",
                    borderRadius: "10px", padding: "8px 18px",
                    fontSize: "13px", fontWeight: 700,
                    color: scanning ? loc.color : "#ffffff",
                    cursor: scanning || !scannerReady ? "not-allowed" : "pointer",
                    boxShadow: scanning ? "none" : "0 2px 10px rgba(33,208,179,0.35)",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  {scanning ? (
                    <>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: loc.color, animation: "scannerPulse 1s infinite", display: "inline-block" }} />
                      Escaneando...
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Iniciar cámara
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={!scanning}
                  onClick={() => void stopScanner()}
                  style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: scanning ? "#475569" : "#cbd5e1", cursor: scanning ? "pointer" : "not-allowed" }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: "6px" }}><rect x="3" y="3" width="18" height="18"/></svg>
                  Detener
                </button>
              </div>
            </div>

            {/* Camera viewport */}
            <div style={{ padding: "16px" }}>
              <div style={{
                borderRadius: "20px",
                border: `2px solid ${scanning ? loc.color : "#e2e8f0"}`,
                background: "linear-gradient(180deg, #020817 0%, #0a1020 100%)",
                padding: "12px",
                position: "relative",
                overflow: "hidden",
                transition: "border-color 0.3s",
              }}>
                {/* Corner brackets */}
                {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((pos) => (
                  <div key={pos} style={{
                    position: "absolute", width: "20px", height: "20px",
                    ...(pos.includes("top") ? { top: "12px" } : { bottom: "12px" }),
                    ...(pos.includes("left") ? { left: "12px" } : { right: "12px" }),
                    borderTop: pos.includes("top") ? `2px solid ${loc.color}` : "none",
                    borderBottom: pos.includes("bottom") ? `2px solid ${loc.color}` : "none",
                    borderLeft: pos.includes("left") ? `2px solid ${loc.color}` : "none",
                    borderRight: pos.includes("right") ? `2px solid ${loc.color}` : "none",
                    opacity: scanning ? 1 : 0.35,
                    transition: "opacity 0.3s",
                  }} />
                ))}

                {/* Scan line animation */}
                {scanning && (
                  <div style={{
                    position: "absolute", left: "12px", right: "12px", height: "2px",
                    background: `linear-gradient(90deg, transparent, ${loc.color}, transparent)`,
                    boxShadow: `0 0 8px ${loc.color}`,
                    animation: "scanLine 2s linear infinite",
                    zIndex: 10,
                  }} />
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", padding: "0 4px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Cámara posterior</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: scanning ? "#10b981" : "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: "5px" }}>
                    {scanning && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "scannerPulse 1s infinite", display: "inline-block" }} />}
                    {scanning ? "Activa" : "En espera"}
                  </span>
                </div>

                <div id={regionId} style={{ minHeight: "340px", width: "100%", overflow: "hidden", borderRadius: "14px", background: "#050c18" }} />
              </div>

              {error && (
                <div style={{ marginTop: "12px", borderRadius: "12px", border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)", padding: "10px 14px", fontSize: "13px", color: "#ef4444", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Right panels */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Success flash overlay */}
            {flashOk && (
              <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ background: "rgba(33,208,179,0.12)", border: "2px solid #21D0B3", borderRadius: "50%", width: "160px", height: "160px", display: "flex", alignItems: "center", justifyContent: "center", animation: "successFlash 1.8s ease forwards", boxShadow: "0 0 60px rgba(33,208,179,0.4)" }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
              </div>
            )}

            {/* Result panel */}
            <div style={{ borderRadius: "20px", border: `1px solid ${currentScan ? loc.color + "40" : "#e2e8f0"}`, background: "#ffffff", overflow: "hidden", boxShadow: currentScan ? `0 4px 20px ${loc.border}` : "0 1px 4px rgba(15,23,42,0.06)", transition: "box-shadow 0.4s, border-color 0.4s" }}>
              <div style={{ borderBottom: `1px solid ${currentScan ? loc.color + "25" : "#e2e8f0"}`, background: currentScan ? loc.bg : "#f8fafc", padding: "14px 18px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: currentScan ? loc.color : "#94a3b8" }}>Último escaneo</p>
                <p style={{ marginTop: "3px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>Resultado de validación</p>
              </div>
              <div style={{ padding: "16px" }}>
                {currentScan ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {/* Location banner */}
                    <div style={{ borderRadius: "14px", background: loc.bg, border: `1px solid ${loc.border}`, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#ffffff", border: `1px solid ${loc.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: loc.color, flexShrink: 0 }}>
                          {LOCATION_ICONS[currentScan.location]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#94a3b8" }}>Acceso validado</p>
                          <p style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>{loc.label}</p>
                          <p style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{currentScan.scannedAt}</p>
                        </div>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(33,208,179,0.1)", border: "1px solid rgba(33,208,179,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Name */}
                    <div style={{ borderRadius: "12px", border: "1px solid #e2e8f0", background: "#f8fafc", padding: "12px 14px" }}>
                      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#94a3b8" }}>Nombre</p>
                      <p style={{ marginTop: "4px", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>{currentScan.fullName}</p>
                    </div>

                    {/* 2-col grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {[
                        { label: "Delegación", value: currentScan.delegation },
                        { label: "Disciplina",  value: currentScan.discipline },
                        { label: "Tipo",        value: currentScan.subjectType === "DRIVER" ? "Conductor" : "Participante" },
                        { label: "Evento",      value: currentScan.eventName },
                      ].map((item) => (
                        <div key={item.label} style={{ borderRadius: "12px", border: "1px solid #e2e8f0", background: "#f8fafc", padding: "10px 12px" }}>
                          <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>{item.label}</p>
                          <p style={{ marginTop: "4px", fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ borderRadius: "14px", border: "1px dashed #e2e8f0", background: "#f8fafc", padding: "40px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px", opacity: 0.3 }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </div>
                    <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.6 }}>Aún no hay lecturas.<br />Selecciona el lugar y escanea una credencial.</p>
                  </div>
                )}
              </div>
            </div>

            {/* History panel */}
            <div style={{ borderRadius: "20px", border: "1px solid #e2e8f0", background: "#ffffff", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
              <div style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>Historial</p>
                  <p style={{ marginTop: "3px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>Últimas validaciones</p>
                </div>
                {history.length > 0 && (
                  <span style={{ background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "3px 10px", fontSize: "12px", fontWeight: 700, color: "#21D0B3" }}>
                    {history.length}
                  </span>
                )}
              </div>
              <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {history.length === 0 ? (
                  <div style={{ borderRadius: "12px", border: "1px dashed #e2e8f0", background: "#f8fafc", padding: "28px 16px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
                    Sin escaneos registrados en esta sesión.
                  </div>
                ) : (
                  history.map((item, index) => {
                    const itemLoc = SCAN_LOCATIONS.find((l) => l.value === item.location) ?? SCAN_LOCATIONS[0];
                    return (
                      <div key={`${item.rawValue}-${index}`} style={{
                        borderRadius: "14px",
                        border: `1px solid ${itemLoc.border}`,
                        borderLeft: `3px solid ${itemLoc.color}`,
                        background: index === 0 ? itemLoc.bg : "#f8fafc",
                        padding: "10px 14px",
                        display: "flex", alignItems: "center", gap: "12px",
                      }}>
                        <div style={{ color: itemLoc.color, flexShrink: 0 }}>{LOCATION_ICONS[item.location]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.fullName}</p>
                          <p style={{ marginTop: "2px", fontSize: "11px", color: "#64748b" }}>{item.delegation} · {item.discipline}</p>
                          <p style={{ marginTop: "1px", fontSize: "10px", color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>{item.scannedAt}</p>
                        </div>
                        <span style={{ background: itemLoc.bg, border: `1px solid ${itemLoc.border}`, borderRadius: "99px", padding: "3px 10px", fontSize: "10px", fontWeight: 700, color: itemLoc.color, flexShrink: 0 }}>
                          {itemLoc.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
