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

const SCAN_LOCATIONS: Array<{ value: ScanLocation; label: string; icon: string; color: string; glow: string; bg: string }> = [
  { value: "ESTADIO",  label: "Estadio",  icon: "🏟",  color: "#3b82f6", glow: "rgba(59,130,246,0.35)",  bg: "rgba(59,130,246,0.15)"  },
  { value: "HOTEL",    label: "Hotel",    icon: "🏨",  color: "#10b981", glow: "rgba(16,185,129,0.35)",  bg: "rgba(16,185,129,0.15)"  },
  { value: "GIMNASIO", label: "Gimnasio", icon: "🏋",  color: "#f59e0b", glow: "rgba(245,158,11,0.35)",  bg: "rgba(245,158,11,0.15)"  },
  { value: "CASINO",   label: "Casino",   icon: "🎰",  color: "#a855f7", glow: "rgba(168,85,247,0.35)",  bg: "rgba(168,85,247,0.15)"  },
];

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
    <main style={{ minHeight: "100vh", background: "#080e1c", color: "#ffffff", fontFamily: "inherit" }}>
      <style>{`
        @keyframes scanLine {
          0%   { top: 0%; opacity: 1; }
          48%  { opacity: 1; }
          50%  { top: 100%; opacity: 0; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes scanPulse {
          0%, 100% { box-shadow: 0 0 0 0 VAR_COLOR; }
          50%       { box-shadow: 0 0 0 10px transparent; }
        }
        @keyframes successFlash {
          0%   { opacity: 0; transform: scale(0.85); }
          30%  { opacity: 1; transform: scale(1.04); }
          100% { opacity: 0; transform: scale(1.08); }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-12px) scale(1.04); }
        }
        @keyframes ringPulse {
          0%   { box-shadow: 0 0 0 0 VAR_GLOW; opacity: 1; }
          100% { box-shadow: 0 0 0 18px transparent; opacity: 0; }
        }
      `}</style>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", minHeight: "100vh", gap: "16px" }}>

        {/* ── Header banner */}
        <section style={{
          borderRadius: "24px",
          background: `linear-gradient(135deg, #0a1628 0%, ${loc.color}66 50%, #0a1628 100%)`,
          border: `1px solid ${loc.color}33`,
          padding: "24px 28px",
          position: "relative",
          overflow: "hidden",
          boxShadow: `0 8px 40px ${loc.glow}, 0 0 0 1px ${loc.color}22`,
          transition: "box-shadow 0.4s ease, border-color 0.4s ease",
        }}>
          {/* Orbs */}
          <div style={{ position: "absolute", top: "-60px", right: "5%", width: "280px", height: "280px", borderRadius: "50%", background: loc.glow, filter: "blur(70px)", pointerEvents: "none", animation: "orbFloat 6s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: "-40px", left: "15%", width: "180px", height: "180px", borderRadius: "50%", background: `${loc.color}22`, filter: "blur(50px)", pointerEvents: "none" }} />

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "20px", position: "relative" }}>
            <div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "99px", padding: "3px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: loc.color, animation: "pulse 2s infinite", display: "inline-block", boxShadow: `0 0 6px ${loc.color}` }} />
                Control de acceso
              </span>
              <h1 style={{ marginTop: "12px", fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, lineHeight: 1.1, textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
                Escaneo QR de credenciales
              </h1>
              <p style={{ marginTop: "8px", fontSize: "14px", color: "rgba(255,255,255,0.7)", maxWidth: "480px" }}>
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
                      border: active ? `2px solid ${item.color}` : "1px solid rgba(255,255,255,0.15)",
                      background: active ? item.bg : "rgba(255,255,255,0.06)",
                      padding: "10px 8px",
                      cursor: "pointer",
                      transition: "all 200ms",
                      textAlign: "left",
                      boxShadow: active ? `0 0 20px ${item.glow}` : "none",
                    }}
                  >
                    <div style={{ fontSize: "18px", marginBottom: "4px" }}>{item.icon}</div>
                    <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: active ? item.color : "rgba(255,255,255,0.45)" }}>Lugar</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: active ? "#ffffff" : "rgba(255,255,255,0.8)", marginTop: "2px" }}>{item.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "16px", flex: 1, alignItems: "start" }}>

          {/* Camera panel */}
          <div style={{ borderRadius: "24px", border: `1px solid ${loc.color}30`, background: "#0d1526", boxShadow: `0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px ${loc.color}15`, overflow: "hidden" }}>
            {/* Panel header */}
            <div style={{ borderBottom: `1px solid ${loc.color}25`, background: `linear-gradient(90deg, ${loc.color}12 0%, transparent 100%)`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: loc.color }}>Cámara activa</p>
                <p style={{ marginTop: "3px", fontSize: "17px", fontWeight: 700, color: "#ffffff" }}>
                  {loc.icon} Escaneo en {loc.label}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  disabled={!scannerReady || scanning}
                  onClick={() => void startScanner()}
                  style={{
                    background: scanning ? "rgba(255,255,255,0.06)" : loc.color,
                    border: `1px solid ${scanning ? "rgba(255,255,255,0.1)" : loc.color}`,
                    borderRadius: "10px", padding: "8px 18px",
                    fontSize: "13px", fontWeight: 700, color: "#ffffff",
                    cursor: scanning || !scannerReady ? "not-allowed" : "pointer",
                    boxShadow: scanning ? "none" : `0 4px 16px ${loc.glow}`,
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  {scanning ? <><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", animation: "pulse 1s infinite", display: "inline-block" }} /> Escaneando...</> : "▶ Iniciar cámara"}
                </button>
                <button
                  type="button"
                  disabled={!scanning}
                  onClick={() => void stopScanner()}
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: scanning ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)", cursor: scanning ? "pointer" : "not-allowed" }}
                >
                  ◼ Detener
                </button>
              </div>
            </div>

            {/* Camera viewport */}
            <div style={{ padding: "16px" }}>
              <div style={{
                borderRadius: "20px",
                border: `2px solid ${scanning ? loc.color : "rgba(255,255,255,0.08)"}`,
                background: "linear-gradient(180deg, #020817 0%, #0a1020 100%)",
                padding: "12px",
                position: "relative",
                overflow: "hidden",
                boxShadow: scanning ? `0 0 30px ${loc.glow}, inset 0 0 30px rgba(0,0,0,0.5)` : "inset 0 0 30px rgba(0,0,0,0.5)",
                transition: "border-color 0.3s, box-shadow 0.3s",
              }}>
                {/* Corner brackets */}
                {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos, i) => (
                  <div key={i} style={{
                    position: "absolute", width: "20px", height: "20px",
                    ...(pos.includes("top") ? { top: "12px" } : { bottom: "12px" }),
                    ...(pos.includes("left") ? { left: "12px" } : { right: "12px" }),
                    borderTop: pos.includes("top") ? `2px solid ${loc.color}` : "none",
                    borderBottom: pos.includes("bottom") ? `2px solid ${loc.color}` : "none",
                    borderLeft: pos.includes("left") ? `2px solid ${loc.color}` : "none",
                    borderRight: pos.includes("right") ? `2px solid ${loc.color}` : "none",
                    opacity: scanning ? 1 : 0.3,
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
                    {scanning && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse 1s infinite", display: "inline-block" }} />}
                    {scanning ? "Activa" : "En espera"}
                  </span>
                </div>

                <div id={regionId} style={{ minHeight: "340px", width: "100%", overflow: "hidden", borderRadius: "14px", background: "#050c18" }} />
              </div>

              {error && (
                <div style={{ marginTop: "12px", borderRadius: "12px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", padding: "10px 14px", fontSize: "13px", color: "#fca5a5", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⚠</span> {error}
                </div>
              )}
            </div>
          </div>

          {/* Right panels */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Success flash overlay */}
            {flashOk && (
              <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ background: `${loc.color}22`, border: `2px solid ${loc.color}`, borderRadius: "50%", width: "160px", height: "160px", display: "flex", alignItems: "center", justifyContent: "center", animation: "successFlash 1.8s ease forwards", boxShadow: `0 0 60px ${loc.glow}` }}>
                  <span style={{ fontSize: "64px" }}>✅</span>
                </div>
              </div>
            )}

            {/* Result panel */}
            <div style={{ borderRadius: "20px", border: `1px solid ${currentScan ? loc.color + "40" : "rgba(255,255,255,0.08)"}`, background: "#0d1526", overflow: "hidden", boxShadow: currentScan ? `0 4px 24px ${loc.glow}` : "none", transition: "box-shadow 0.4s, border-color 0.4s" }}>
              <div style={{ borderBottom: `1px solid ${currentScan ? loc.color + "30" : "rgba(255,255,255,0.07)"}`, background: currentScan ? `linear-gradient(90deg, ${loc.color}15 0%, transparent 100%)` : "rgba(255,255,255,0.03)", padding: "14px 18px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: currentScan ? loc.color : "rgba(255,255,255,0.35)" }}>Último escaneo</p>
                <p style={{ marginTop: "3px", fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>Resultado de validación</p>
              </div>
              <div style={{ padding: "16px" }}>
                {currentScan ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {/* Location banner */}
                    <div style={{ borderRadius: "14px", background: `linear-gradient(135deg, ${loc.color}cc 0%, ${loc.color}44 100%)`, padding: "14px 16px", boxShadow: `0 4px 20px ${loc.glow}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "28px" }}>{loc.icon}</span>
                        <div>
                          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>Acceso validado</p>
                          <p style={{ fontSize: "20px", fontWeight: 800, color: "#ffffff" }}>{loc.label}</p>
                          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)", marginTop: "2px" }}>{currentScan.scannedAt}</p>
                        </div>
                        <span style={{ marginLeft: "auto", fontSize: "28px" }}>✅</span>
                      </div>
                    </div>

                    {/* Name (full width) */}
                    <div style={{ borderRadius: "12px", border: `1px solid ${loc.color}25`, background: `${loc.color}0d`, padding: "12px 14px" }}>
                      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Nombre</p>
                      <p style={{ marginTop: "4px", fontSize: "20px", fontWeight: 800, color: "#ffffff" }}>{currentScan.fullName}</p>
                    </div>

                    {/* 2-col grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {[
                        { label: "Delegación", value: currentScan.delegation, icon: "🌎" },
                        { label: "Disciplina",  value: currentScan.discipline, icon: "🏅" },
                        { label: "Tipo",        value: currentScan.subjectType === "DRIVER" ? "Conductor" : "Participante", icon: "👤" },
                        { label: "Evento",      value: currentScan.eventName,  icon: "🗓" },
                      ].map((item) => (
                        <div key={item.label} style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", padding: "10px 12px" }}>
                          <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span>{item.icon}</span>{item.label}
                          </p>
                          <p style={{ marginTop: "4px", fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ borderRadius: "14px", border: "1px dashed rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", padding: "40px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: "36px", marginBottom: "12px", opacity: 0.4 }}>📷</div>
                    <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Aún no hay lecturas.<br />Selecciona el lugar y escanea una credencial.</p>
                  </div>
                )}
              </div>
            </div>

            {/* History panel */}
            <div style={{ borderRadius: "20px", border: "1px solid rgba(255,255,255,0.08)", background: "#0d1526", overflow: "hidden" }}>
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Historial</p>
                  <p style={{ marginTop: "3px", fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>Últimas validaciones</p>
                </div>
                {history.length > 0 && (
                  <span style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "99px", padding: "3px 10px", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
                    {history.length}
                  </span>
                )}
              </div>
              <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {history.length === 0 ? (
                  <div style={{ borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", padding: "28px 16px", textAlign: "center", fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
                    Sin escaneos registrados en esta sesión.
                  </div>
                ) : (
                  history.map((item, index) => {
                    const itemLoc = SCAN_LOCATIONS.find((l) => l.value === item.location) ?? SCAN_LOCATIONS[0];
                    return (
                      <div key={`${item.rawValue}-${index}`} style={{
                        borderRadius: "14px",
                        border: `1px solid ${itemLoc.color}25`,
                        borderLeft: `3px solid ${itemLoc.color}`,
                        background: index === 0 ? `${itemLoc.color}10` : "rgba(255,255,255,0.03)",
                        padding: "10px 14px",
                        display: "flex", alignItems: "center", gap: "12px",
                      }}>
                        <span style={{ fontSize: "20px", flexShrink: 0 }}>{itemLoc.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: "13px", color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.fullName}</p>
                          <p style={{ marginTop: "2px", fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>{item.delegation} · {item.discipline}</p>
                          <p style={{ marginTop: "1px", fontSize: "10px", color: "rgba(255,255,255,0.3)", fontVariantNumeric: "tabular-nums" }}>{item.scannedAt}</p>
                        </div>
                        <span style={{ background: itemLoc.bg, border: `1px solid ${itemLoc.color}40`, borderRadius: "99px", padding: "3px 10px", fontSize: "10px", fontWeight: 700, color: itemLoc.color, flexShrink: 0 }}>
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
