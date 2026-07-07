"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Partner,
  clearPartner,
  getStoredPartner,
  partnerFetch,
} from "@/lib/partnerAuth";

const TEAL = "#21D0B3";
const TEAL_MID = "#34F3C6";

type ClaimPreview = {
  id: string;
  couponId: string;
  uniqueCode: string;
  qrToken: string;
  status: "CLAIMED" | "REDEEMED" | "EXPIRED" | "REVOKED";
  userName?: string | null;
  userType?: string | null;
  claimedAt: string;
  expiresAt: string;
  redeemedAt?: string | null;
  coupon?: {
    id: string;
    title: string;
    discountType?: string;
    discountValue?: number | null;
    category?: string;
    partnerName?: string;
    termsAndConditions?: string | null;
  };
};

type Mode = "idle" | "scanning" | "manual" | "preview" | "success" | "error";

function discountDisplay(c: any) {
  if (!c) return "—";
  switch (c.discountType) {
    case "PERCENTAGE":
      return c.discountValue ? `${c.discountValue}% OFF` : "Descuento";
    case "AMOUNT":
      return c.discountValue ? `$${Number(c.discountValue).toLocaleString("es-CL")}` : "$";
    case "FREE":
      return "GRATIS";
    default:
      return c.discountValue?.toString() || "Beneficio";
  }
}

const fmtFull = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "-";

export default function PartnerScannerPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [manualCode, setManualCode] = useState("");
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemedBy, setRedeemedBy] = useState("");
  const [stats, setStats] = useState<{
    totalRedemptions: number;
    todayRedemptions: number;
    eligibleCoupons: number;
    pendingClaims: number;
    stockRemaining: number | null;
  } | null>(null);
  const [recentRedemptions, setRecentRedemptions] = useState<Array<{
    id: string;
    uniqueCode: string;
    userName?: string | null;
    userType?: string | null;
    redeemedAt: string;
    redeemedBy?: string | null;
    coupon?: { title: string; discountType?: string; discountValue?: number | null; category?: string };
  }>>([]);

  const scannerRef = useRef<any>(null);
  const containerId = "partner-qr-reader";

  useEffect(() => {
    const stored = getStoredPartner();
    if (!stored) {
      router.replace("/portal/partner");
      return;
    }
    setPartner(stored);
    loadStats();
    loadRecentRedemptions();
  }, []);

  const loadRecentRedemptions = async () => {
    try {
      const r = await partnerFetch<typeof recentRedemptions>("/coupon-partners/me/redemptions");
      setRecentRedemptions(Array.isArray(r) ? r : []);
    } catch { /* no-op */ }
  };

  const loadStats = async () => {
    try {
      const s = await partnerFetch<{
        totalRedemptions: number;
        todayRedemptions: number;
        eligibleCoupons: number;
        pendingClaims: number;
        stockRemaining: number | null;
      }>("/coupon-partners/me/stats");
      setStats(s);
    } catch { /* no-op */ }
  };

  useEffect(() => {
    if (mode !== "scanning") { stopScanner(); return; }
    startScanner();
    return () => { stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const startScanner = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const inst = new Html5Qrcode(containerId);
      scannerRef.current = inst;
      await inst.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decoded: string) => {
          await stopScanner();
          await validate(decoded);
        },
        () => { },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la cámara");
      setMode("error");
    }
  };

  const stopScanner = async () => {
    const inst = scannerRef.current;
    if (inst) {
      try { await inst.stop(); await inst.clear(); } catch {/* ignore */}
      scannerRef.current = null;
    }
  };

  const validate = async (token: string) => {
    setError(null);
    try {
      const r = await partnerFetch<ClaimPreview>("/coupon-partners/me/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setPreview(r);
      setMode("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
      setMode("error");
    }
  };

  const confirmRedeem = async () => {
    if (!preview) return;
    setRedeeming(true); setError(null);
    try {
      await partnerFetch("/coupon-partners/me/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: preview.qrToken,
          redeemedBy: redeemedBy || undefined,
        }),
      });
      setMode("success");
      loadStats();
      loadRecentRedemptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error confirmando canje");
      setMode("error");
    } finally { setRedeeming(false); }
  };

  const reset = () => {
    setPreview(null);
    setManualCode("");
    setError(null);
    setRedeemedBy("");
    setMode("idle");
  };

  const logout = () => {
    clearPartner();
    router.replace("/portal/partner");
  };

  return (
    <div className="min-h-screen relative overflow-hidden"
      style={{ background: "linear-gradient(175deg, #eef2f8 0%, #f6f8fc 45%, #e9eef6 100%)" }}>

      <style jsx global>{`
        @keyframes float-orb-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -30px) scale(1.1); }
        }
        @keyframes float-orb-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50px, 40px) scale(1.15); }
        }
        @keyframes shimmer-bg {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 12px 32px ${TEAL}50, 0 0 0 0 ${TEAL}40; }
          50% { box-shadow: 0 16px 40px ${TEAL}70, 0 0 0 14px ${TEAL}00; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-pop {
          0% { opacity: 0; transform: scale(0.7); }
          60% { transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes scan-line {
          0%, 100% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          50% { top: 90%; opacity: 1; }
          60% { opacity: 0; }
        }
        @keyframes count-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .anim-fade-up { animation: fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .anim-fade-in { animation: fade-in 400ms ease-out both; }
        .anim-scale-pop { animation: scale-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .anim-pulse-glow { animation: pulse-glow 2.5s ease-in-out infinite; }
        .anim-orb-1 { animation: float-orb-1 12s ease-in-out infinite; }
        .anim-orb-2 { animation: float-orb-2 14s ease-in-out infinite; }
        .anim-count { animation: count-pulse 0.4s ease-out; }
        .shimmer-line {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer-bg 3s linear infinite;
        }
        .scan-line {
          position: absolute;
          left: 10%; right: 10%;
          height: 2px;
          background: linear-gradient(90deg, transparent, ${TEAL}, transparent);
          box-shadow: 0 0 16px ${TEAL};
          animation: scan-line 2s ease-in-out infinite;
        }
        .btn-press:active { transform: scale(0.97); }
      `}</style>

      {/* Ambient orbs */}
      <div className="anim-orb-1" style={{
        position: "fixed", top: "-5%", right: "-5%", zIndex: 0,
        width: "500px", height: "500px",
        background: `radial-gradient(circle, ${TEAL}25 0%, transparent 65%)`,
        pointerEvents: "none", filter: "blur(50px)",
      }} />
      <div className="anim-orb-2" style={{
        position: "fixed", bottom: "-10%", left: "-5%", zIndex: 0,
        width: "400px", height: "400px",
        background: "radial-gradient(circle, rgba(31,205,255,0.12) 0%, transparent 65%)",
        pointerEvents: "none", filter: "blur(50px)",
      }} />

      {/* Grid pattern sutil */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: "radial-gradient(circle, rgba(15,23,42,0.04) 1px, transparent 1px)",
        backgroundSize: "30px 30px",
        pointerEvents: "none",
        maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
      }} />

      {/* Header sticky con logo */}
      <header className="sticky top-0 z-20 backdrop-blur-md"
        style={{
          background: "rgba(255,255,255,0.9)",
          borderBottom: "1px solid #e2e8f0",
        }}>
        {/* Shimmer line abajo del header */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] shimmer-line" />
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/branding/LOGO-SEVEN-1.png"
              alt="Seven Arena"
              style={{
                height: "34px", width: "auto", flexShrink: 0,
                filter: "drop-shadow(0 2px 6px rgba(15,23,42,0.12))",
              }}
            />
            <div className="min-w-0">
              <p className="text-[9px] font-bold tracking-[0.25em] uppercase"
                style={{ color: "#0e9384" }}>Partner</p>
              <h1 className="text-sm font-bold truncate" style={{ color: "#0d1e3a" }}>
                {partner?.name || "..."}
              </h1>
              <p className="text-[10px] font-mono" style={{ color: "#64748b" }}>
                {partner?.code}
              </p>
            </div>
          </div>
          <button type="button"
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex-shrink-0 btn-press"
            style={{
              color: "#475569",
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#e6ebf2";
              e.currentTarget.style.color = "#0d1e3a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.color = "#475569";
            }}
            onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-5 space-y-4">

        {/* Stats cards — siempre visibles (placeholders 0 si aún no cargó) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Canjes hoy" value={stats?.todayRedemptions ?? 0} color="#34F3C6" />
          <StatCard label="Total acumulado" value={stats?.totalRedemptions ?? 0} color="#a78bfa" />
          <StatCard
            label="Beneficios"
            value={stats?.eligibleCoupons ?? 0}
            color="#1FCDFF"
            hint="habilitados"
          />
          <StatCard
            label="Por validar"
            value={stats?.pendingClaims ?? 0}
            color="#fcd34d"
            hint="reclamados sin canjear"
          />
          <StatCard
            label="Stock"
            value={stats?.stockRemaining === null ? "∞" : (stats?.stockRemaining ?? 0)}
            color={
              !stats || stats.stockRemaining === null
                ? "#21D0B3"
                : stats.stockRemaining === 0
                ? "#ef4444"
                : stats.stockRemaining < 10
                ? "#f59e0b"
                : "#21D0B3"
            }
            hint={
              stats?.stockRemaining === null
                ? "ilimitado"
                : stats?.stockRemaining === 0
                ? "agotado"
                : "disponibles"
            }
          />
        </div>

        {/* Pantalla principal según modo */}
        {mode === "idle" && (
          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <IdleScreen
              onScan={() => setMode("scanning")}
              onManual={() => setMode("manual")}
            />
            <RecentRedemptionsCard items={recentRedemptions} onRefresh={loadRecentRedemptions} />
          </div>
        )}

        {mode === "scanning" && (
          <ScannerScreen
            containerId={containerId}
            onCancel={() => setMode("idle")}
            onManual={() => setMode("manual")}
          />
        )}

        {mode === "manual" && (
          <ManualScreen
            code={manualCode}
            setCode={setManualCode}
            onCancel={() => setMode("idle")}
            onSubmit={() => validate(manualCode.trim())}
          />
        )}

        {mode === "preview" && preview && (
          <PreviewScreen
            preview={preview}
            redeemedBy={redeemedBy}
            setRedeemedBy={setRedeemedBy}
            redeeming={redeeming}
            onCancel={reset}
            onConfirm={confirmRedeem}
          />
        )}

        {mode === "success" && (
          <ResultScreen
            kind="success"
            title="¡Cupón canjeado!"
            subtitle={preview?.coupon?.title}
            onContinue={reset}
          />
        )}

        {mode === "error" && (
          <ResultScreen
            kind="error"
            title="No se pudo canjear"
            subtitle={error || "Error desconocido"}
            onContinue={reset}
          />
        )}
      </main>
    </div>
  );
}

// ── Componentes ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, color, hint,
}: {
  label: string;
  value: number | string;
  color: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden anim-fade-up transition-all hover:scale-[1.02]"
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderTop: `3px solid ${color}`,
        boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        cursor: "default",
      }}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full"
        style={{ background: `${color}18`, filter: "blur(24px)" }} />
      <div className="relative z-10">
        <p className="text-[10px] uppercase tracking-widest font-bold"
          style={{ color: "#64748b" }}>
          {label}
        </p>
        <p key={String(value)} className="text-3xl font-bold mt-1 anim-count" style={{ color }}>
          {value}
        </p>
        {hint && (
          <p className="text-[10px] mt-0.5"
            style={{ color: "#94a3b8" }}>
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

function IdleScreen({ onScan, onManual }: { onScan: () => void; onManual: () => void }) {
  return (
    <div className="rounded-3xl p-8 text-center relative overflow-hidden anim-fade-up"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 4px 16px rgba(15,23,42,0.08), 0 0 0 1px rgba(33,208,179,0.10)",
      }}>
      {/* Shimmer line arriba */}
      <div className="absolute top-0 left-0 right-0 h-[1px] shimmer-line" />

      {/* Halo decorativo animado */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full anim-orb-1"
        style={{ background: `radial-gradient(circle, ${TEAL}30 0%, transparent 70%)` }} />

      <div className="relative z-10 space-y-5">
        <div className="w-24 h-24 rounded-3xl mx-auto flex items-center justify-center anim-pulse-glow anim-scale-pop"
          style={{
            background: `linear-gradient(135deg, ${TEAL} 0%, #1eb19a 100%)`,
          }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <rect x="7" y="7" width="4" height="4" />
            <rect x="13" y="7" width="4" height="4" />
            <rect x="7" y="13" width="4" height="4" />
            <path d="M13 13h4v4h-4z" />
          </svg>
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "#0d1e3a" }}>
            Validar cupón
          </h2>
          <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: "#5e6b7a" }}>
            Escanea el QR del atleta con la cámara o ingresa el código manualmente.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button type="button" onClick={onScan}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-all relative overflow-hidden btn-press group"
            style={{
              background: `linear-gradient(135deg, ${TEAL} 0%, #1eb19a 100%)`,
              boxShadow: `0 8px 24px ${TEAL}50`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 12px 32px ${TEAL}70`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = `0 8px 24px ${TEAL}50`;
            }}>
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Escanear QR
            </span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer-bg 1.5s linear infinite",
              }} />
          </button>
          <button type="button" onClick={onManual}
            className="w-full py-3.5 rounded-2xl text-sm font-medium transition-all btn-press"
            style={{
              background: "#f1f5f9",
              color: "#0d1e3a",
              border: "1px solid #e2e8f0",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
            }}>
            Ingresar código manualmente
          </button>
        </div>
      </div>
    </div>
  );
}

function ScannerScreen({
  containerId, onCancel, onManual,
}: {
  containerId: string;
  onCancel: () => void;
  onManual: () => void;
}) {
  return (
    <div className="rounded-3xl overflow-hidden anim-fade-up relative"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 4px 16px rgba(15,23,42,0.08), 0 0 0 1px #eef1f6",
      }}>
      <div className="absolute top-0 left-0 right-0 h-[1px] shimmer-line z-10" />
      <div className="px-5 py-3.5 border-b flex items-center justify-between"
        style={{ borderColor: "#eef1f6" }}>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: TEAL }}>
            Escaneando
          </p>
          <p className="text-sm font-semibold" style={{ color: "#0d1e3a" }}>
            Apuntá la cámara al QR
          </p>
        </div>
        <button type="button"
          className="text-sm font-medium px-3 py-1.5 rounded-lg"
          style={{ background: "#f1f5f9", color: "#5e6b7a" }}
          onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <div className="relative" style={{ aspectRatio: "1/1" }}>
        <div id={containerId} className="w-full h-full bg-black" />
        {/* Línea de scan animada */}
        <div className="scan-line" />
        {/* Esquinas del marco */}
        <div className="absolute top-[10%] left-[10%] w-8 h-8 border-l-2 border-t-2 rounded-tl-lg pointer-events-none"
          style={{ borderColor: TEAL }} />
        <div className="absolute top-[10%] right-[10%] w-8 h-8 border-r-2 border-t-2 rounded-tr-lg pointer-events-none"
          style={{ borderColor: TEAL }} />
        <div className="absolute bottom-[10%] left-[10%] w-8 h-8 border-l-2 border-b-2 rounded-bl-lg pointer-events-none"
          style={{ borderColor: TEAL }} />
        <div className="absolute bottom-[10%] right-[10%] w-8 h-8 border-r-2 border-b-2 rounded-br-lg pointer-events-none"
          style={{ borderColor: TEAL }} />
      </div>
      <div className="p-3.5 text-center" style={{ background: "#f8fafc" }}>
        <button type="button"
          className="text-xs font-medium underline"
          style={{ color: TEAL }}
          onClick={onManual}>
          ¿El QR no escanea? Ingresa el código a mano
        </button>
      </div>
    </div>
  );
}

function ManualScreen({
  code, setCode, onCancel, onSubmit,
}: {
  code: string;
  setCode: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-3xl p-6 space-y-4 relative overflow-hidden anim-fade-up"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 4px 16px rgba(15,23,42,0.08), 0 0 0 1px #eef1f6",
      }}>
      <div className="absolute top-0 left-0 right-0 h-[1px] shimmer-line" />
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: TEAL }}>
          Ingreso manual
        </p>
        <h2 className="text-xl font-bold mt-0.5" style={{ color: "#0d1e3a" }}>
          Código del cupón
        </h2>
        <p className="text-xs mt-1" style={{ color: "#5e6b7a" }}>
          Pedile al atleta que te dicte el código debajo de su QR (formato: CPN-XXXXXX).
        </p>
      </div>

      <input
        type="text"
        className="w-full px-4 py-4 rounded-2xl text-2xl font-mono uppercase text-center tracking-wider transition-all"
        style={{
          background: "#f8fafc",
          border: "2px solid #e2e8f0",
          outline: "none",
          color: "#0d1e3a",
        }}
        placeholder="CPN-AB12CD"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onFocus={(e) => { e.target.style.borderColor = TEAL; e.target.style.background = "#fff"; }}
        onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; }}
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter" && code.trim()) onSubmit(); }}
      />

      <div className="flex gap-2.5">
        <button type="button"
          className="flex-1 py-3.5 rounded-2xl text-sm font-medium transition-all"
          style={{ background: "#f1f5f9", color: "#0d1e3a", border: "1px solid #e2e8f0" }}
          onClick={onCancel}>
          Volver
        </button>
        <button type="button"
          disabled={!code.trim()}
          className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-white transition-all"
          style={{
            background: !code.trim() ? "#9ba3ad"
              : `linear-gradient(135deg, ${TEAL} 0%, #1eb19a 100%)`,
            boxShadow: !code.trim() ? "none" : `0 6px 18px ${TEAL}50`,
            cursor: !code.trim() ? "not-allowed" : "pointer",
          }}
          onClick={onSubmit}>
          Validar
        </button>
      </div>
    </div>
  );
}

function PreviewScreen({
  preview, redeemedBy, setRedeemedBy, redeeming, onCancel, onConfirm,
}: {
  preview: ClaimPreview;
  redeemedBy: string;
  setRedeemedBy: (v: string) => void;
  redeeming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-3xl overflow-hidden anim-fade-up relative"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 4px 16px rgba(15,23,42,0.08), 0 0 0 1px #eef1f6",
      }}>
      <div className="p-5 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${TEAL} 0%, #1eb19a 100%)` }}>
        {/* Orbes decorativos en el header */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full anim-orb-1"
          style={{ background: "rgba(255,255,255,0.2)", filter: "blur(20px)" }} />
        <div className="absolute bottom-0 left-10 w-24 h-24 rounded-full anim-orb-2"
          style={{ background: "rgba(255,255,255,0.15)", filter: "blur(20px)" }} />
        {/* Shimmer abajo */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] shimmer-line opacity-60" />
        <div className="relative z-10">
          <p className="text-[10px] uppercase tracking-widest font-bold text-white opacity-80">
            ✓ Cupón válido
          </p>
          <h2 className="text-xl font-bold text-white leading-tight mt-1">
            {preview.coupon?.title || "Cupón"}
          </h2>
          <p className="text-4xl font-extrabold text-white mt-2 anim-scale-pop">
            {discountDisplay(preview.coupon)}
          </p>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <DetailRow label="Atleta" value={preview.userName || "—"} />
        <DetailRow label="Tipo" value={preview.userType || "—"} />
        <DetailRow label="Código" value={preview.uniqueCode}
          valueClass="font-mono font-bold" valueColor="#0d1e3a" />
        <DetailRow label="Reclamado" value={fmtFull(preview.claimedAt)} />
        <DetailRow label="Expira" value={fmtFull(preview.expiresAt)} valueColor="#c78c00" />

        {preview.coupon?.termsAndConditions && (
          <details className="text-xs pt-1">
            <summary className="cursor-pointer font-semibold" style={{ color: TEAL }}>
              Ver términos y condiciones
            </summary>
            <p className="mt-2 leading-relaxed p-3 rounded-lg"
              style={{ color: "#5e6b7a", background: "#f8fafc" }}>
              {preview.coupon.termsAndConditions}
            </p>
          </details>
        )}

        <label className="block pt-1">
          <span className="block text-[10px] uppercase tracking-widest font-bold mb-1.5"
            style={{ color: "#5e6b7a" }}>
            Validado por (opcional)
          </span>
          <input type="text"
            className="w-full px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{
              background: "#f8fafc",
              border: "2px solid #e2e8f0",
              outline: "none",
              color: "#0d1e3a",
            }}
            placeholder="Tu nombre"
            value={redeemedBy}
            onChange={(e) => setRedeemedBy(e.target.value)}
            onFocus={(e) => { e.target.style.borderColor = TEAL; e.target.style.background = "#fff"; }}
            onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; }}
          />
        </label>

        <div className="flex gap-2.5 pt-2">
          <button type="button"
            disabled={redeeming}
            className="flex-1 py-3.5 rounded-2xl text-sm font-medium transition-all"
            style={{ background: "#f1f5f9", color: "#0d1e3a", border: "1px solid #e2e8f0" }}
            onClick={onCancel}>
            Cancelar
          </button>
          <button type="button"
            disabled={redeeming}
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-white transition-all"
            style={{
              background: redeeming ? "#9ba3ad"
                : "linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)",
              boxShadow: redeeming ? "none" : "0 6px 18px rgba(46,125,50,0.4)",
              cursor: redeeming ? "not-allowed" : "pointer",
            }}>
            {redeeming ? "Procesando…" : "✓ Confirmar canje"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({
  kind, title, subtitle, onContinue,
}: {
  kind: "success" | "error";
  title: string;
  subtitle?: string;
  onContinue: () => void;
}) {
  const isSuccess = kind === "success";
  const grad = isSuccess
    ? "linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)"
    : "linear-gradient(135deg, #b3231b 0%, #d32f2f 100%)";
  const shadow = isSuccess
    ? "0 12px 32px rgba(46,125,50,0.5)"
    : "0 12px 32px rgba(179,35,27,0.5)";
  const accent = isSuccess ? "#2e7d32" : "#b3231b";

  return (
    <div className="rounded-3xl p-8 text-center space-y-5 anim-fade-up relative overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 4px 16px rgba(15,23,42,0.08), 0 0 0 1px #eef1f6",
      }}>
      <div className="absolute top-0 left-0 right-0 h-[1px] shimmer-line" />
      {/* Halo del color del resultado */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full"
        style={{
          background: `radial-gradient(circle, ${isSuccess ? "#4caf5040" : "#d32f2f30"} 0%, transparent 70%)`,
        }} />
      <div className="relative z-10 space-y-5">
      <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center anim-scale-pop"
        style={{ background: grad, boxShadow: shadow }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {isSuccess
            ? <polyline points="20 6 9 17 4 12" />
            : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
        </svg>
      </div>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: accent }}>{title}</h2>
        {subtitle && (
          <p className="text-sm mt-1.5" style={{ color: "#5e6b7a" }}>{subtitle}</p>
        )}
      </div>
      <button type="button" onClick={onContinue}
        className="w-full py-3.5 rounded-2xl text-base font-semibold text-white transition-all"
        style={{
          background: `linear-gradient(135deg, ${TEAL} 0%, #1eb19a 100%)`,
          boxShadow: `0 6px 18px ${TEAL}50`,
        }}>
        {isSuccess ? "Validar otro cupón →" : "Reintentar"}
      </button>
      </div>
    </div>
  );
}

// ── Card: Canjes recientes (panel derecho del dashboard) ────────────────────

function RecentRedemptionsCard({
  items,
  onRefresh,
}: {
  items: Array<{
    id: string;
    uniqueCode: string;
    userName?: string | null;
    userType?: string | null;
    redeemedAt: string;
    redeemedBy?: string | null;
    coupon?: { title: string; discountType?: string; discountValue?: number | null; category?: string };
  }>;
  onRefresh: () => void;
}) {
  const fmtRelative = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "hace unos segundos";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  };

  const discountText = (c?: { discountType?: string; discountValue?: number | null }) => {
    if (!c) return "";
    if (c.discountType === "PERCENTAGE" && c.discountValue) return `${c.discountValue}% OFF`;
    if (c.discountType === "AMOUNT" && c.discountValue) return `$${Number(c.discountValue).toLocaleString("es-CL")}`;
    if (c.discountType === "FREE") return "GRATIS";
    return "";
  };

  return (
    <div className="rounded-3xl overflow-hidden anim-fade-up relative"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 4px 16px rgba(15,23,42,0.08), 0 0 0 1px rgba(33,208,179,0.10)",
      }}>
      <div className="absolute top-0 left-0 right-0 h-[1px] shimmer-line" />

      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between"
        style={{ borderColor: "#eef1f6" }}>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: TEAL }}>
            Actividad reciente
          </p>
          <h3 className="text-lg font-bold mt-0.5" style={{ color: "#0d1e3a" }}>
            Últimos canjes
          </h3>
        </div>
        <button type="button"
          onClick={onRefresh}
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg"
          style={{ background: "#f1f5f9", color: "#475569" }}
          title="Refrescar">
          ↻
        </button>
      </div>

      {/* Lista */}
      <div className="overflow-y-auto" style={{ maxHeight: 480 }}>
        {items.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: "rgba(33,208,179,0.1)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={TEAL}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v2a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: "#0d1e3a" }}>
              Sin canjes aún
            </p>
            <p className="text-xs mt-1" style={{ color: "#5e6b7a" }}>
              Cuando valides el primer cupón aparecerá acá.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "#eef1f6" }}>
            {items.map((r) => (
              <div key={r.id} className="p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)",
                    color: "#fff",
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: "#0d1e3a" }}>
                      {r.coupon?.title || "Cupón"}
                    </p>
                    {discountText(r.coupon) && (
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: "#2e7d32" }}>
                        {discountText(r.coupon)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "#5e6b7a" }}>
                    {r.userName || "Anónimo"}
                    {r.userType && <span className="ml-1.5 text-[10px] font-mono">· {r.userType}</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: "#eef1f6", color: "#475569" }}>
                      {r.uniqueCode}
                    </span>
                    <span className="text-[10px]" style={{ color: "#94a3b8" }}>
                      {fmtRelative(r.redeemedAt)}
                    </span>
                    {r.redeemedBy && (
                      <span className="text-[10px] italic" style={{ color: "#94a3b8" }}>
                        · por {r.redeemedBy}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label, value, valueClass, valueColor,
}: {
  label: string;
  value: string;
  valueClass?: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
      style={{ borderColor: "#eef1f6" }}>
      <span className="text-[10px] uppercase tracking-widest font-bold"
        style={{ color: "#5e6b7a" }}>{label}</span>
      <span className={`text-sm text-right ${valueClass || "font-medium"}`}
        style={{ color: valueColor || "#0d1e3a" }}>
        {value}
      </span>
    </div>
  );
}
